// supabase/functions/triage-chamado/index.ts
// Triagem automatica de prioridade de chamados pela IA.
// Body: { chamado_id }
// Le titulo+descricao+categoria, classifica em baixa/media/alta/urgente,
// faz UPDATE em chamados.prioridade. Fire-and-forget do createChamado.
//
// Usa Haiku 4.5 (rapido + barato; triagem nao precisa de Sonnet).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { consumeIaRateLimit } from '../_shared/rate-limit.ts'
import { Logger } from '../_shared/log.ts'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM = `Voce e um triador de chamados de manutencao de condominios.
Analise o chamado e classifique a PRIORIDADE em uma das opcoes:

- urgente: risco imediato a vida, integridade ou patrimonio. Ex.: incendio,
  vazamento de gas, fio exposto com risco de choque, pessoa presa em elevador,
  agua jorrando, falta de agua predial, falta de energia em todo o predio.
- alta: afeta uso essencial do condomino agora. Ex.: elevador parado, agua
  vazando em apartamento, esgoto entupido com refluxo, portao quebrado sem
  acesso, fechadura quebrada, vidro estilhacado.
- media: incomodo significativo mas nao impede uso. Ex.: lampada queimada
  em area comum, infiltracao iniciando, fechadura emperrando, piscina suja,
  intercomunicador com chiado, vagao com alerta de manutencao.
- baixa: pequeno reparo cosmetico ou preventivo. Ex.: tinta descascando,
  jardim precisando de poda, pequeno arranhao, sugestao de melhoria.

Responda SOMENTE com JSON valido no formato:
{"prioridade":"baixa|media|alta|urgente","razao":"frase curta explicando"}`

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  const log = new Logger('triage-chamado')

  try {
    const body = await req.json()
    const chamado_id: string | undefined = body?.chamado_id
    if (!chamado_id) return jsonResponse({ error: 'chamado_id obrigatorio.' }, 400)

    const auth = req.headers.get('Authorization')
    if (auth) {
      // Rate limit so se tiver auth (chamadas internas service-role passam)
      const rl = await consumeIaRateLimit(auth).catch(() => ({ allowed: true }))
      if (!rl.allowed) return jsonResponse({ error: 'Rate limit.' }, 429)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY ausente.' }, 500)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: chamado, error: errCham } = await admin
      .from('chamados')
      .select('id, titulo, descricao, categoria, prioridade')
      .eq('id', chamado_id)
      .maybeSingle()
    if (errCham || !chamado) return jsonResponse({ error: 'Chamado nao encontrado.' }, 404)

    const userPrompt = `Categoria: ${chamado.categoria}
Titulo: ${chamado.titulo}
Descricao: ${chamado.descricao}`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      log.error('claude_api_failed', { status: resp.status, body: txt.slice(0, 500) })
      return jsonResponse({ error: 'IA indisponivel.' }, 502)
    }

    const data = await resp.json()
    const text: string = data?.content?.[0]?.text ?? ''
    let parsed: { prioridade?: string; razao?: string } = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch {
      // ignora, fica null
    }

    const prio = parsed.prioridade
    if (prio !== 'baixa' && prio !== 'media' && prio !== 'alta' && prio !== 'urgente') {
      return jsonResponse({ error: 'Resposta IA invalida.', raw: text.slice(0, 200) }, 422)
    }

    // So sobrescreve se o chamado foi aberto com 'media' (default).
    // Se o morador escolheu manualmente outra prioridade, respeitamos.
    if (chamado.prioridade === 'media') {
      await admin
        .from('chamados')
        .update({ prioridade: prio })
        .eq('id', chamado_id)
    }

    log.info('triage_ok', { chamado_id, prioridade: prio })
    return jsonResponse({ prioridade: prio, razao: parsed.razao ?? null })
  } catch (e) {
    log.error('uncaught', { error: e instanceof Error ? e.message : String(e) })
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 500)
  }
})
