// supabase/functions/cron-multa-vencimentos/index.ts
// Cron diario: encontra multas aplicadas com vencimento em 3 dias ou ja vencidas
// e dispara e-mail de lembrete. Idempotente via tabela multa_lembretes_enviados.
//
// Agendamento (executar uma vez via SQL):
//   select cron.schedule(
//     'multa-vencimentos-diario',
//     '0 9 * * *',
//     $$ select net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/cron-multa-vencimentos',
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isoToday = today.toISOString().slice(0, 10)
    const in3days = new Date(today.getTime() + 3 * 86400_000).toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 86400_000).toISOString().slice(0, 10)

    // Busca multas aplicadas com vencimento em <= 3 dias
    const { data: multas, error } = await sb
      .from('multas')
      .select('id, condominio_id, pessoa_id, valor, descricao, artigo_regimento, vencimento_em')
      .eq('status', 'aplicada')
      .not('vencimento_em', 'is', null)
      .lte('vencimento_em', in3days)
    if (error) throw error

    let processadas = 0
    let enviadas = 0

    for (const m of multas ?? []) {
      processadas++
      const venc = m.vencimento_em as string
      let tipo: 'vencimento_3d' | 'vencimento_1d' | 'vencido' = 'vencimento_3d'
      if (venc < isoToday) tipo = 'vencido'
      else if (venc === isoToday || venc <= yesterday) tipo = 'vencimento_1d'
      else tipo = 'vencimento_3d'

      // Idempotencia: ja enviou esse tipo?
      const { data: ja } = await sb
        .from('multa_lembretes_enviados')
        .select('id')
        .eq('multa_id', m.id)
        .eq('tipo', tipo)
        .maybeSingle()
      if (ja) continue

      if (!m.pessoa_id) continue
      const { data: pessoa } = await sb
        .from('pessoas')
        .select('nome, email')
        .eq('id', m.pessoa_id)
        .maybeSingle()
      if (!pessoa?.email) continue

      const { data: condo } = await sb
        .from('condominios')
        .select('nome')
        .eq('id', m.condominio_id)
        .maybeSingle()

      const valorFmt = `R$ ${Number(m.valor).toFixed(2).replace('.', ',')}`
      const vencFmt = formatDate(venc)
      const isVencido = tipo === 'vencido'

      const subject = isVencido
        ? `Multa em atraso — ${valorFmt}`
        : `Lembrete: multa vence em ${diasAteVencimento(venc, today)} dia(s)`

      const corpo = isVencido
        ? `<p>Olá, ${escapeHtml(pessoa.nome ?? 'morador(a)')}.</p>
<p>A multa em seu nome venceu em <strong>${vencFmt}</strong> e ainda consta como pendente.</p>
<p><strong>Valor:</strong> ${valorFmt}</p>
${m.artigo_regimento ? `<p><strong>Base:</strong> ${escapeHtml(m.artigo_regimento)}</p>` : ''}
<p>Por favor, regularize o quanto antes pelo aplicativo ou junto à administração.</p>`
        : `<p>Olá, ${escapeHtml(pessoa.nome ?? 'morador(a)')}.</p>
<p>Sua multa de <strong>${valorFmt}</strong> vence em <strong>${vencFmt}</strong>.</p>
${m.artigo_regimento ? `<p><strong>Base:</strong> ${escapeHtml(m.artigo_regimento)}</p>` : ''}
<p>Você pode acompanhar e quitar pelo app.</p>`

      const resp = await fetch(`${url}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: pessoa.email,
          template: 'custom',
          condominio_id: m.condominio_id,
          custom: { subject, html: corpo },
          vars: { condominio_nome: condo?.nome },
        }),
      })
      if (!resp.ok) {
        console.warn('[cron-multa] send-email falhou:', await resp.text())
        continue
      }

      await sb.from('multa_lembretes_enviados').insert({ multa_id: m.id, tipo })
      enviadas++
    }

    return jsonResponse({ ok: true, processadas, enviadas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron-multa-vencimentos]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function diasAteVencimento(venc: string, today: Date): number {
  const v = new Date(venc + 'T00:00:00').getTime()
  const t = today.getTime()
  return Math.max(0, Math.round((v - t) / 86400_000))
}
