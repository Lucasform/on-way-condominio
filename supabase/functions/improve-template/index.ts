// supabase/functions/improve-template/index.ts
// Recebe esboço de template (chat ou email) e retorna versão polida via Haiku.
//
// Body: {
//   tipo: 'chat' | 'email',
//   titulo: string,
//   corpo: string,
//   assunto?: string,                  // so faz sentido em email
//   condominio_id?: string,             // pra trazer nome + ai_instrucoes
// }
// Resposta: { corpo: string, assunto?: string }

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const MODEL = 'claude-haiku-4-5-20251001'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const body = await req.json()
    const tipo: 'chat' | 'email' = body?.tipo === 'email' ? 'email' : 'chat'
    const titulo: string = String(body?.titulo ?? '').trim()
    const corpo: string = String(body?.corpo ?? '').trim()
    const assuntoIn: string = String(body?.assunto ?? '').trim()
    const condominio_id: string | undefined = body?.condominio_id

    if (!corpo) {
      return jsonResponse({ error: 'Corpo do template não pode estar vazio.' }, 400)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada.' }, 500)
    }

    // Contexto do condomínio (nome + ai_instrucoes), se houver
    let condoNome = 'condomínio'
    let aiInstrucoes: string | null = null
    if (condominio_id) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data } = await admin
        .from('condominios')
        .select('nome, ai_instrucoes')
        .eq('id', condominio_id)
        .maybeSingle()
      if (data?.nome) condoNome = data.nome
      if (data?.ai_instrucoes) aiInstrucoes = data.ai_instrucoes
    }

    const tipoLabel = tipo === 'email' ? 'e-mail formal' : 'mensagem de chat informal'
    const guideEmail = `
- Estrutura padrão: saudação curta, contexto, instrução clara, despedida cordial.
- Use parágrafos curtos com quebras de linha (\\n\\n entre eles).
- Tom: profissional e respeitoso, sem ser frio.
- Pode usar 1 ou 2 emojis sutis (📦, 📌, ⚠, ✓) no início ou em destaques. Não exagere.
- Se o texto for sobre uma ação que o morador precisa fazer, deixe ela em uma linha separada.
- Não invente datas, valores ou nomes. Use placeholders entre colchetes [LIKE_THIS] se necessário.`
    const guideChat = `
- Tom direto e gentil, como mensagem rápida na conversa.
- Frases curtas. 1 ou 2 linhas costuma bastar.
- Pode usar 1 emoji sutil (👍, 📦, 📌, ⚠) no início se ajudar.
- Mantenha o objetivo da mensagem original.`

    const system = `Você é um redator de comunicações condominiais para o condomínio "${condoNome}".
Sua tarefa: pegar o ESBOÇO de um template de ${tipoLabel} e devolver uma versão polida e pronta para uso.

Regras gerais:
- Mantenha o OBJETIVO original do esboço. Não invente fatos novos.
- Português brasileiro claro, sem regionalismos.
- NÃO use travessão "—" no meio de frases (use vírgula, parênteses, ponto, ou dois pontos).
- Não use markdown (sem **, sem #).${tipo === 'email' ? guideEmail : guideChat}
${aiInstrucoes ? `\nINSTRUÇÕES DESTE CONDOMÍNIO (siga o tom):\n${aiInstrucoes}` : ''}

Responda EXCLUSIVAMENTE em JSON, sem markdown:
${tipo === 'email'
  ? '{"corpo": "texto melhorado", "assunto": "linha de assunto curta e objetiva"}'
  : '{"corpo": "texto melhorado"}'}`

    const userMsg = `${titulo ? `Título interno do template: ${titulo}\n` : ''}${
      tipo === 'email' && assuntoIn ? `Assunto atual: ${assuntoIn}\n` : ''
    }
ESBOÇO:
${corpo}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return jsonResponse({ error: `Claude API ${res.status}: ${errText.slice(0, 400)}` }, 500)
    }
    const data = await res.json()
    const rawText: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse({ error: 'Resposta sem JSON válido.', raw: rawText.slice(0, 300) }, 502)
    }
    let parsed: { corpo?: string; assunto?: string }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return jsonResponse({ error: 'JSON inválido.', raw: rawText.slice(0, 300) }, 502)
    }

    return jsonResponse({
      corpo: parsed.corpo ?? corpo,
      assunto: tipo === 'email' ? (parsed.assunto ?? assuntoIn ?? null) : null,
      modelo: MODEL,
      tokens: {
        input: data?.usage?.input_tokens ?? null,
        output: data?.usage?.output_tokens ?? null,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
