// supabase/functions/suggest-chat-reply/index.ts
// FASE 15 / Leva B — sugere resposta de staff no chat com base nas últimas mensagens
// da conversa, contexto do morador, regimento via RAG e ai_instrucoes do condomínio.
//
// Body: { conversa_id: uuid }
// Auth: JWT válido (usuário staff logado com acesso à conversa via RLS).
// Resposta: { sugestao: string, modelo: string, tokens: {...} }

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { consumeIaRateLimit } from '../_shared/rate-limit.ts'

// @ts-expect-error: Supabase.ai injetado pelo runtime
const session = new Supabase.ai.Session('gte-small')

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const MAX_MENSAGENS_CONTEXTO = 15

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const rl = await consumeIaRateLimit(auth)
    if (!rl.allowed) {
      return jsonResponse({
        error: `Rate limit atingido (30 chamadas IA/hora). Tente novamente após ${rl.reset_at ?? 'em breve'}.`,
        rate_limit: rl,
      }, 429)
    }

    const body = await req.json()
    const conversa_id: string | undefined = body?.conversa_id
    if (!conversa_id) return jsonResponse({ error: 'conversa_id obrigatório.' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada.' }, 500)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )

    // 1) Busca conversa
    const { data: conversa, error: cErr } = await userClient
      .from('conversas')
      .select('id, condominio_id, morador_user_id, assunto, status')
      .eq('id', conversa_id)
      .maybeSingle()
    if (cErr || !conversa) {
      return jsonResponse({ error: `Conversa não encontrada: ${cErr?.message ?? ''}` }, 404)
    }

    // 2) Últimas N mensagens
    const { data: mensagensRaw } = await userClient
      .from('mensagens')
      .select('autor_tipo, conteudo, created_at')
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: false })
      .limit(MAX_MENSAGENS_CONTEXTO)
    const mensagens = (mensagensRaw ?? []).reverse() as Array<{
      autor_tipo: string
      conteudo: string
      created_at: string
    }>

    // 3) Nome do morador + unidade
    const { data: pessoaMorador } = await userClient
      .from('pessoas')
      .select('nome, unidades:unidade_id(bloco, numero)')
      .eq('user_id', conversa.morador_user_id)
      .maybeSingle()
    const moradorNome = pessoaMorador?.nome ?? 'morador'
    const u = (pessoaMorador as { unidades?: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null })?.unidades
    const uFlat = Array.isArray(u) ? u[0] : u
    const unidadeStr = uFlat
      ? (uFlat.bloco ? `${uFlat.bloco}-${uFlat.numero}` : uFlat.numero)
      : null

    // 4) Contexto do condomínio
    const { data: condoCtx } = await userClient
      .from('condominios')
      .select('nome, ai_instrucoes')
      .eq('id', conversa.condominio_id)
      .maybeSingle()
    const condoNome = condoCtx?.nome ?? 'condomínio'
    const aiInstrucoes: string | null = (condoCtx?.ai_instrucoes ?? '').trim() || null

    // 5) RAG no regimento com base nas últimas mensagens do morador
    const queryText = mensagens
      .filter((m) => m.autor_tipo === 'morador')
      .slice(-3)
      .map((m) => m.conteudo)
      .join('\n')
      .trim()
    let artigosTexto = ''
    if (queryText) {
      try {
        const embOut = await session.run(queryText, { mean_pool: true, normalize: true })
        const queryEmbedding = Array.isArray(embOut) ? embOut : Array.from(embOut as number[])
        const { data: artigos } = await userClient.rpc('match_regimento_artigos', {
          query_embedding: queryEmbedding,
          p_condominio_id: conversa.condominio_id,
          match_count: 3,
          similarity_threshold: 0.2,
        })
        const artigosList = (artigos ?? []) as Array<{ numero: string | null; titulo: string; conteudo: string }>
        if (artigosList.length > 0) {
          artigosTexto = artigosList
            .map((a) => `[${a.numero ?? 's/n'}] ${a.titulo}\n${a.conteudo}`)
            .join('\n\n')
        }
      } catch (_) { /* RAG opcional */ }
    }

    // 6) Monta prompt
    const partes: string[] = [
      `Você é um assistente da administração do condomínio "${condoNome}".
Tarefa: ler o histórico do chat com o morador "${moradorNome}"${unidadeStr ? ` (unidade ${unidadeStr})` : ''} e sugerir UMA mensagem de resposta direta, gentil e objetiva.

Regras:
- Português brasileiro claro, sem regionalismos.
- Tom direto e respeitoso, como mensagem de chat.
- Não invente fatos. Se faltar informação, peça-a de forma educada.
- NÃO use travessão "—" no meio de frase (use vírgula, parênteses, ponto ou dois pontos).
- Sem markdown, sem **, sem listas longas. Frases curtas.
- 1 ou 2 emojis sutis no máximo (👍, 📌, 📦, ⚠) se ajudar.
- Retorne SOMENTE o texto da resposta, sem aspas e sem cabeçalho.`,
    ]
    if (artigosTexto) {
      partes.push(`ARTIGOS DO REGIMENTO POSSIVELMENTE RELEVANTES:\n${artigosTexto}`)
    }
    if (aiInstrucoes) {
      partes.push(`INSTRUÇÕES DESTE CONDOMÍNIO:\n${aiInstrucoes}`)
    }

    const historico = mensagens.length === 0
      ? '(sem histórico)'
      : mensagens
          .map((m) => {
            const quem = m.autor_tipo === 'morador' ? `Morador (${moradorNome})` : m.autor_tipo === 'staff' ? 'Administração' : m.autor_tipo === 'bot' ? 'Bot' : 'Sistema'
            return `${quem}: ${m.conteudo}`
          })
          .join('\n')

    const userPrompt = `Assunto da conversa: ${conversa.assunto}

HISTÓRICO (mais antigo no topo):
${historico}

Escreva a próxima mensagem da Administração.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: partes.join('\n\n---\n\n'),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      return jsonResponse({ error: `Claude API ${res.status}: ${txt.slice(0, 400)}` }, 500)
    }
    const data = await res.json()
    const sugestao: string = String(data?.content?.[0]?.text ?? '').trim()
    if (!sugestao) {
      return jsonResponse({ error: 'Resposta vazia da IA.' }, 502)
    }

    return jsonResponse({
      sugestao,
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
