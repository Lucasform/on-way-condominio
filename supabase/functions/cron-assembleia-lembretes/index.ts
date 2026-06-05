// supabase/functions/cron-assembleia-lembretes/index.ts
// Cron diario: assembleias planejadas que ocorrem nas proximas 24h recebem
// um lembrete por e-mail pra todos os moradores ativos do condo.
// Idempotente via assembleia_lembretes_enviados.
//
// Agendamento (SQL, uma vez):
//   select cron.schedule(
//     'assembleia-lembrete-diario',
//     '0 10 * * *',
//     $$ select net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/cron-assembleia-lembretes',
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
    const limite = new Date(agora.getTime() + 24 * 3600_000)

    const { data: assembleias, error } = await sb
      .from('assembleias')
      .select('id, condominio_id, titulo, tipo, data_assembleia, local, pauta')
      .eq('status', 'planejada')
      .gte('data_assembleia', agora.toISOString())
      .lte('data_assembleia', limite.toISOString())
    if (error) throw error

    let processadas = 0
    let enviadas = 0

    for (const a of assembleias ?? []) {
      processadas++
      // Idempotencia
      const { data: ja } = await sb
        .from('assembleia_lembretes_enviados')
        .select('id')
        .eq('assembleia_id', a.id)
        .eq('tipo', '24h')
        .maybeSingle()
      if (ja) continue

      const { data: pessoas } = await sb
        .from('pessoas')
        .select('email')
        .eq('condominio_id', a.condominio_id)
        .eq('ativo', true)
        .not('email', 'is', null)
      const emails = (pessoas ?? []).map((p) => p.email as string).filter(Boolean)
      if (emails.length === 0) continue

      const { data: condo } = await sb
        .from('condominios')
        .select('nome')
        .eq('id', a.condominio_id)
        .maybeSingle()

      const dataFmt = new Date(a.data_assembleia).toLocaleString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })

      const corpo = `<p>Olá.</p>
<p>Lembramos que a assembleia <strong>${escapeHtml(a.titulo)}</strong> acontece em <strong>${escapeHtml(dataFmt)}</strong>.</p>
${a.local ? `<p><strong>Local:</strong> ${escapeHtml(a.local)}</p>` : ''}
${a.pauta ? `<p><strong>Pauta:</strong><br>${escapeHtml(a.pauta).replace(/\n/g, '<br>')}</p>` : ''}
<p>Confirme sua presença pelo aplicativo.</p>`

      const resp = await fetch(`${url}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          to: emails,
          template: 'custom',
          condominio_id: a.condominio_id,
          custom: { subject: `📣 Assembleia amanhã: ${a.titulo}`, html: corpo },
          vars: { condominio_nome: condo?.nome },
        }),
      })
      if (!resp.ok) {
        console.warn('[cron-assembleia] send-email falhou:', await resp.text())
        continue
      }

      // Alerta interno pro staff
      const { data: staff } = await sb
        .from('perfis').select('id')
        .eq('condominio_id', a.condominio_id)
        .in('role', ['sindico', 'subsindico', 'administradora']).eq('ativo', true)
      const alertas = ((staff ?? []) as Array<{ id: string }>).map((s) => ({
        user_id: s.id, condominio_id: a.condominio_id, tipo: 'assembleia_lembrete',
        titulo: `Assembleia amanhã: ${a.titulo}`,
        conteudo: `${dataFmt}${a.local ? ` · ${a.local}` : ''}`,
        link: `/assembleias/${a.id}`,
      }))
      if (alertas.length > 0) await sb.from('app_notifications').insert(alertas)

      await sb.from('assembleia_lembretes_enviados').insert({ assembleia_id: a.id, tipo: '24h' })
      enviadas++
    }

    return jsonResponse({ ok: true, processadas, enviadas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron-assembleia-lembretes]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}
