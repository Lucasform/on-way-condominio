// supabase/functions/generate-comunicado/index.ts
// Gera um comunicado padronizado a partir de uma descricao livre + modelo
// de comunicado anexado ao condominio (condominio_anexos.modelo_comunicado).
//
// Body: { condominio_id, descricao, titulo_sugerido? }
// Resposta: { titulo, corpo, ia_modelo, modelo_anexo_id }

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { consumeIaRateLimit } from '../_shared/rate-limit.ts'
import { Logger } from '../_shared/log.ts'

const MODEL = 'claude-haiku-4-5-20251001'

Deno.serve(async (req: Request) => {
  const log = new Logger('generate-comunicado')
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const rl = await consumeIaRateLimit(auth)
    if (!rl.allowed) {
      return jsonResponse({
        error: 'Rate limit atingido (30 chamadas IA/hora).',
        rate_limit: rl,
      }, 429)
    }

    const body = await req.json()
    const condominio_id: string | undefined = body?.condominio_id
    const descricao: string = String(body?.descricao ?? '').trim()
    const titulo_sugerido: string | undefined = body?.titulo_sugerido

    if (!condominio_id) return jsonResponse({ error: 'condominio_id obrigatório.' }, 400)
    if (!descricao) return jsonResponse({ error: 'descricao obrigatória.' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY ausente.' }, 500)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Contexto do condominio: nome + ai_instrucoes
    const { data: condo } = await admin
      .from('condominios')
      .select('nome, ai_instrucoes')
      .eq('id', condominio_id)
      .maybeSingle()
    const condoNome: string = condo?.nome ?? 'condomínio'
    const aiInstrucoes: string | null = condo?.ai_instrucoes ?? null

    // Modelo de comunicado anexado (texto extraido)
    const { data: modelo } = await admin
      .from('condominio_anexos')
      .select('id, texto_extraido')
      .eq('condominio_id', condominio_id)
      .eq('tipo', 'modelo_comunicado')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const modeloTexto: string | null = modelo?.texto_extraido ?? null
    const modeloAnexoId: string | null = modelo?.id ?? null

    const system = `Você é um redator oficial de comunicados condominiais para o condomínio "${condoNome}".
Sua tarefa: pegar a DESCRIÇÃO livre do gestor e devolver um comunicado pronto pra ser enviado aos moradores.

Regras gerais:
- Português brasileiro formal mas acessível.
- NÃO use travessão "—" no meio de frases (use vírgula, parênteses, ponto ou dois pontos).
- Sem markdown. Sem invenção de fatos, valores, datas ou nomes não citados.
- Estrutura: saudação curta, contexto/motivo, ação ou prazo, despedida cordial.
- Parágrafos curtos com quebras de linha duplas entre eles (\\n\\n).
- Pode usar 1 ou 2 emojis sutis em destaques (📅, 📌, ⚠, ✓), não exagerar.
- Encerre com assinatura institucional: "Administração / Síndico do Condomínio ${condoNome}".

${modeloTexto ? `MODELO PADRÃO DO CONDOMÍNIO (siga o tom e estrutura deste exemplo):\n"""\n${modeloTexto.slice(0, 3000)}\n"""\n` : ''}
${aiInstrucoes ? `INSTRUÇÕES ESPECÍFICAS DESTE CONDOMÍNIO:\n${aiInstrucoes}\n` : ''}

Responda SOMENTE com JSON válido no formato:
{"titulo":"...","corpo":"..."}

O título deve ter no máximo 70 caracteres e ser claro (ex.: "Manutenção da caixa d'água - dia 12/06").
O corpo deve ser texto puro com parágrafos separados por \\n\\n.`

    const userPrompt = `Descrição do gestor:
${descricao}

${titulo_sugerido ? `Título sugerido pelo gestor: ${titulo_sugerido}\n` : ''}

Gere o comunicado.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      log.error('claude_api_failed', { status: resp.status, body: txt.slice(0, 500) })
      return jsonResponse({ error: 'IA indisponível.' }, 502)
    }

    const data = await resp.json()
    const text: string = data?.content?.[0]?.text ?? ''
    let parsed: { titulo?: string; corpo?: string } = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch {
      // ignora
    }

    if (!parsed.titulo || !parsed.corpo) {
      return jsonResponse({ error: 'Resposta IA inválida.', raw: text.slice(0, 200) }, 422)
    }

    return jsonResponse({
      titulo: String(parsed.titulo).trim(),
      corpo: String(parsed.corpo).trim(),
      ia_modelo: MODEL,
      modelo_anexo_id: modeloAnexoId,
    })
  } catch (e) {
    log.error('uncaught', { error: e instanceof Error ? e.message : String(e) })
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 500)
  }
})
