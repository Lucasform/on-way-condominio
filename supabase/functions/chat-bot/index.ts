// supabase/functions/chat-bot/index.ts
// Bot do chat — Claude Haiku 4.5 responde mensagens em conversas.
// Acessa contexto: condomínio, regimento (RAG), histórico recente.
//
// Body: { conversa_id: uuid }
// Auth: JWT (usuário logado OU service_role).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// @ts-expect-error: Supabase.ai injetado pelo runtime
const session = new Supabase.ai.Session('gte-small')

const BOT_MODEL = 'claude-haiku-4-5'

interface BotOutput {
  resposta: string
  transferir_humano: boolean
  motivo_transferir?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const { conversa_id } = await req.json()
    if (!conversa_id) return jsonResponse({ error: 'conversa_id obrigatório.' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY ausente.' }, 500)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1) Carrega conversa
    const { data: conversa, error: cErr } = await admin
      .from('conversas')
      .select('id, condominio_id, morador_user_id, assunto, status')
      .eq('id', conversa_id)
      .single()
    if (cErr || !conversa) return jsonResponse({ error: 'Conversa não encontrada.' }, 404)

    if (conversa.status === 'em_atendimento' || conversa.status === 'encerrada') {
      return jsonResponse({
        skipped: true,
        reason: `Conversa em status ${conversa.status} — bot não responde.`,
      })
    }

    // 2) Carrega últimas mensagens
    const { data: msgs } = await admin
      .from('mensagens')
      .select('autor_tipo, conteudo, created_at')
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const historico = (msgs ?? []).reverse()
    if (historico.length === 0) {
      return jsonResponse({ skipped: true, reason: 'Sem mensagens.' })
    }

    // Última mensagem do morador (gatilho do bot)
    const ultimaMoradorIdx = [...historico].reverse().findIndex((m) => m.autor_tipo === 'morador')
    if (ultimaMoradorIdx === -1) {
      return jsonResponse({ skipped: true, reason: 'Sem mensagem do morador no histórico recente.' })
    }
    const ultimaMorador = historico[historico.length - 1 - ultimaMoradorIdx]

    // 3) Carrega condomínio
    const { data: condo } = await admin
      .from('condominios')
      .select('nome')
      .eq('id', conversa.condominio_id)
      .single()

    // 4) RAG: artigos relevantes pra última msg do morador
    const embOut = await session.run(ultimaMorador.conteudo, { mean_pool: true, normalize: true })
    const queryEmbedding = Array.isArray(embOut) ? embOut : Array.from(embOut as number[])

    const { data: artigos } = await admin.rpc('match_regimento_artigos', {
      query_embedding: queryEmbedding,
      p_condominio_id: conversa.condominio_id,
      match_count: 3,
      similarity_threshold: 0.3,
    })

    const artigosCtx = (artigos ?? []) as Array<{
      numero: string | null
      titulo: string
      conteudo: string
    }>

    // 5) Monta prompt
    const systemPrompt = `Você é um assistente de chat do condomínio ${condo?.nome ?? ''}.
Você ajuda moradores com dúvidas SIMPLES sobre regimento, horários, encomendas, e procedimentos comuns.

REGRAS:
- Responda em português (PT-BR), tom cordial e direto.
- Use os artigos do regimento fornecidos abaixo SE forem relevantes — cite o número do artigo.
- NÃO invente artigos.
- NÃO tome decisões administrativas (não promete prazos, não cancela multas, não atribui culpa).
- Se a pergunta:
  * envolve uma multa específica do morador
  * pede para falar com síndico/administradora
  * é reclamação séria, conflito entre moradores, ou emergência
  * você não tem informação suficiente
  → marque transferir_humano = true.

Responda EXCLUSIVAMENTE em JSON válido neste schema (sem markdown):
{
  "resposta": string,                          // sua resposta pro morador
  "transferir_humano": boolean,
  "motivo_transferir": string                  // breve, só se transferir_humano=true
}`

    const historicoTxt = historico
      .map((m) => `${m.autor_tipo === 'morador' ? 'MORADOR' : m.autor_tipo === 'bot' ? 'VOCÊ (bot)' : 'STAFF'}: ${m.conteudo}`)
      .join('\n\n')

    const artigosTxt = artigosCtx.length === 0
      ? '(sem artigos relevantes)'
      : artigosCtx.map((a) => `[${a.numero ?? 's/n'}] ${a.titulo}\n${a.conteudo}`).join('\n\n')

    const userPrompt = `ASSUNTO DA CONVERSA: ${conversa.assunto}

HISTÓRICO RECENTE:
${historicoTxt}

ARTIGOS DO REGIMENTO POTENCIALMENTE RELEVANTES:
${artigosTxt}

Responda a última mensagem do morador.`

    // 6) Claude Haiku
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: BOT_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const t = await anthropicRes.text()
      return jsonResponse({ error: `Claude API ${anthropicRes.status}: ${t.slice(0, 300)}` }, 500)
    }

    const data = await anthropicRes.json()
    const rawText: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse({ error: 'Resposta sem JSON.', raw: rawText.slice(0, 300) }, 502)
    }

    let output: BotOutput
    try {
      output = JSON.parse(jsonMatch[0]) as BotOutput
    } catch (e) {
      return jsonResponse({ error: `JSON inválido: ${e}`, raw: rawText.slice(0, 300) }, 502)
    }

    // 7) Insere mensagem do bot
    await admin.from('mensagens').insert({
      conversa_id,
      autor_id: null,
      autor_tipo: 'bot',
      conteudo: output.resposta,
      metadata: {
        modelo: BOT_MODEL,
        tokens: data?.usage,
        artigos_consultados: artigosCtx.map((a) => a.numero ?? 's/n'),
        transferir: output.transferir_humano,
      },
    })

    // 8) Se bot pediu transferir, marca status + msg sistema
    if (output.transferir_humano) {
      await admin
        .from('conversas')
        .update({ status: 'aguardando_humano' })
        .eq('id', conversa_id)

      await admin.from('mensagens').insert({
        conversa_id,
        autor_id: null,
        autor_tipo: 'sistema',
        conteudo: `Bot transferiu pra um humano. ${output.motivo_transferir ?? ''}`,
      })
    }

    return jsonResponse({
      ok: true,
      modelo: BOT_MODEL,
      output,
      tokens: data?.usage,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
