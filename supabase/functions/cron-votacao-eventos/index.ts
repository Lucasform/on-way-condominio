// supabase/functions/cron-votacao-eventos/index.ts
// Cron diario (ou de hora em hora): dispara push pros moradores de:
//  - abertura: votacoes ativas iniciadas nas ultimas 24h e ainda sem push
//  - encerramento_24h: votacoes que encerram nas proximas 24h
//  - encerramento: votacoes que ja encerraram nas ultimas 24h
// Idempotente via votacao_eventos_enviados.
//
// Agendamento (SQL, uma vez):
//   select cron.schedule(
//     'votacao-eventos',
//     '15 * * * *',
//     $$ select net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/cron-votacao-eventos',
//          headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role_key'))
//        ) $$
//   );

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(url, serviceKey)

    const agora = new Date()
    const ontem = new Date(agora.getTime() - 24 * 3600_000)
    const amanha = new Date(agora.getTime() + 24 * 3600_000)

    let totalAbertura = 0
    let totalEncerramento24h = 0
    let totalEncerramento = 0

    // --- ABERTURAS ---
    const { data: abertas } = await sb
      .from('votacoes')
      .select('id, condominio_id, titulo')
      .eq('status', 'aberta')
      .eq('ativo', true)
      .gte('data_inicio', ontem.toISOString())
      .lte('data_inicio', agora.toISOString())
    for (const v of abertas ?? []) {
      const sent = await dispatchEvento(sb, url, serviceKey, v.id, v.condominio_id, 'abertura',
        '🗳 Nova votação aberta',
        v.titulo,
        `/votacoes/${v.id}`)
      if (sent) totalAbertura++
    }

    // --- ENCERRAMENTO 24H ---
    const { data: prestes } = await sb
      .from('votacoes')
      .select('id, condominio_id, titulo, data_fim')
      .eq('status', 'aberta')
      .eq('ativo', true)
      .not('data_fim', 'is', null)
      .gte('data_fim', agora.toISOString())
      .lte('data_fim', amanha.toISOString())
    for (const v of prestes ?? []) {
      const sent = await dispatchEvento(sb, url, serviceKey, v.id, v.condominio_id, 'encerramento_24h',
        '⏰ Votação encerra em breve',
        `${v.titulo} — encerra em até 24h`,
        `/votacoes/${v.id}`)
      if (sent) totalEncerramento24h++
    }

    // --- ENCERRAMENTOS RECENTES ---
    const { data: recem } = await sb
      .from('votacoes')
      .select('id, condominio_id, titulo, data_fim')
      .eq('status', 'aberta')
      .eq('ativo', true)
      .not('data_fim', 'is', null)
      .gte('data_fim', ontem.toISOString())
      .lt('data_fim', agora.toISOString())
    for (const v of recem ?? []) {
      const sent = await dispatchEvento(sb, url, serviceKey, v.id, v.condominio_id, 'encerramento',
        '✓ Votação encerrada',
        `${v.titulo} — confira o resultado`,
        `/votacoes/${v.id}`)
      if (sent) totalEncerramento++
    }

    return jsonResponse({
      ok: true,
      abertura: totalAbertura,
      encerramento_24h: totalEncerramento24h,
      encerramento: totalEncerramento,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron-votacao-eventos]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

async function dispatchEvento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  url: string,
  serviceKey: string,
  votacao_id: string,
  condominio_id: string,
  tipo: 'abertura' | 'encerramento_24h' | 'encerramento',
  titulo: string,
  corpo: string,
  link: string,
): Promise<boolean> {
  const { data: ja } = await sb
    .from('votacao_eventos_enviados')
    .select('id')
    .eq('votacao_id', votacao_id)
    .eq('tipo', tipo)
    .maybeSingle()
  if (ja) return false

  const { data: pessoas } = await sb
    .from('pessoas')
    .select('user_id')
    .eq('condominio_id', condominio_id)
    .eq('ativo', true)
    .not('user_id', 'is', null)
  const userIds = (pessoas ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean)
  if (userIds.length === 0) return false

  await fetch(`${url}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ user_ids: userIds, titulo, corpo, link }),
  }).catch(() => {})

  await sb.from('votacao_eventos_enviados').insert({ votacao_id, tipo })
  return true
}
