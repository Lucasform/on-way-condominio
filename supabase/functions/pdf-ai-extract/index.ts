// supabase/functions/pdf-ai-extract/index.ts
// Motor central de extração de dados via PDF + Claude.
// Recebe um PDF em base64 + contexto e retorna JSON estruturado.
//
// Body: { context: PdfContext, pdf_base64: string, filename?: string }
// Auth: JWT válido.
// Secrets: ANTHROPIC_API_KEY

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { consumeIaRateLimit } from '../_shared/rate-limit.ts'

const CLAUDE_MODEL = 'claude-haiku-4-5'
const MAX_PDF_BYTES = 5 * 1024 * 1024 // 5 MB base64 decoded estimate

type PdfContext = 'unidades' | 'pessoas' | 'ocorrencia' | 'comunicado'

const PROMPTS: Record<PdfContext, string> = {
  unidades: `Leia este documento e extraia todas as unidades/apartamentos/salas/lojas listadas.
Para cada unidade identifique:
- bloco: bloco, torre, prédio ou letra identificadora (null se não houver)
- numero: número da unidade (obrigatório)
- tipo: exatamente um de "apartamento", "casa", "sala", "loja", "outro"
- area_m2: área em metros quadrados como número decimal (null se não mencionado)

Se o documento for uma planta ou memorial descritivo, extraia todas as unidades que conseguir identificar.
Responda SOMENTE com JSON válido, sem markdown, sem explicação:
{
  "unidades": [
    { "bloco": "A", "numero": "101", "tipo": "apartamento", "area_m2": 65.5 }
  ]
}`,

  pessoas: `Leia este documento e extraia todos os moradores, residentes, proprietários ou funcionários listados.
Para cada pessoa identifique:
- nome: nome completo (obrigatório)
- cpf: somente dígitos sem pontuação (null se não houver)
- email: endereço de e-mail (null se não houver)
- telefone: somente dígitos sem pontuação (null se não houver)
- tipo_vinculo: um de "titular", "conjuge", "filho", "dependente", "inquilino", "funcionario", "outro"
- unidade_numero: número da unidade onde mora/trabalha (null se não identificado)
- bloco: bloco/torre da unidade (null se não identificado)

Responda SOMENTE com JSON válido, sem markdown, sem explicação:
{
  "pessoas": [
    { "nome": "João Silva", "cpf": "12345678900", "email": "joao@email.com", "telefone": "11999990000", "tipo_vinculo": "titular", "bloco": "A", "unidade_numero": "101" }
  ]
}`,

  ocorrencia: `Leia este documento (boletim de ocorrência, relato, laudo, notificação ou similar) e extraia as informações para registrar uma ocorrência no sistema de gestão do condomínio.

Responda SOMENTE com JSON válido, sem markdown, sem explicação:
{
  "descricao": "Descrição completa e objetiva do ocorrido, preservando os fatos relevantes",
  "local": "Local específico onde ocorreu (ex: Garagem, Corredor do 3º andar, Piscina, Área comum)",
  "unidade_numero": "101",
  "bloco": "A"
}

Se não houver unidade específica identificada, use null para unidade_numero e bloco.`,

  comunicado: `Leia este documento e gere um comunicado formal para os moradores do condomínio.
Preserve as informações essenciais (datas, horários, procedimentos). Mantenha tom profissional e respeitoso. Seja objetivo e claro.

Responda SOMENTE com JSON válido, sem markdown, sem explicação:
{
  "titulo": "Título objetivo e descritivo do comunicado",
  "corpo": "Texto completo do comunicado pronto para envio, com parágrafos separados por \\n\\n"
}`,
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const rl = await consumeIaRateLimit(auth)
    if (!rl.allowed) {
      return jsonResponse({
        error: `Rate limit atingido (30 chamadas IA/hora). Tente após ${rl.reset_at ?? 'em breve'}.`,
        rate_limit: rl,
      }, 429)
    }

    const body = await req.json()
    const { context, pdf_base64, filename, instrucoes } = body as {
      context: PdfContext
      pdf_base64: string
      filename?: string
      instrucoes?: string
    }

    if (!context || !PROMPTS[context]) {
      return jsonResponse(
        { error: 'context inválido. Use: unidades, pessoas, ocorrencia, comunicado.' },
        400,
      )
    }
    if (!pdf_base64) {
      return jsonResponse({ error: 'pdf_base64 obrigatório.' }, 400)
    }

    // Estimativa do tamanho real (base64 tem overhead ~33%)
    const estimatedBytes = Math.floor(pdf_base64.length * 0.75)
    if (estimatedBytes > MAX_PDF_BYTES) {
      return jsonResponse(
        { error: `PDF muito grande. Máximo ${MAX_PDF_BYTES / 1024 / 1024} MB.` },
        413,
      )
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada.' }, 500)
    }

    // Monta o prompt final: base + instruções específicas do usuário (se houver)
    const promptFinal = instrucoes?.trim()
      ? `${PROMPTS[context]}\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${instrucoes.trim()}`
      : PROMPTS[context]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf_base64,
                },
                ...(filename ? { title: filename } : {}),
              },
              {
                type: 'text',
                text: promptFinal,
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return jsonResponse(
        { error: `Claude API ${res.status}: ${err.slice(0, 500)}` },
        502,
      )
    }

    const data = await res.json()
    const rawText: string = data?.content?.[0]?.text ?? ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse(
        { error: 'Resposta da IA sem JSON válido.', raw: rawText.slice(0, 300) },
        502,
      )
    }

    let extracted: unknown
    try {
      extracted = JSON.parse(jsonMatch[0])
    } catch (e) {
      return jsonResponse(
        {
          error: `JSON inválido: ${e instanceof Error ? e.message : String(e)}`,
          raw: rawText.slice(0, 300),
        },
        502,
      )
    }

    return jsonResponse({
      context,
      extracted,
      modelo: CLAUDE_MODEL,
      tokens: {
        input: data?.usage?.input_tokens ?? null,
        output: data?.usage?.output_tokens ?? null,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
