// supabase/functions/processar-envio-fila/index.ts
// Cron (3min): reprocessa envios que falharam (e-mail/WhatsApp) com backoff.
// E-mail: lote maior (Resend aguenta). WhatsApp: cuidado anti-ban — poucas
// por rodada, sequencial com delay/jitter, máx tentativas e sem retry em
// falha permanente (número sem WhatsApp).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const EMAIL_LOTE = 30
const WA_LOTE = 8                 // teto por rodada (anti-ban)
const WA_DELAY_MS = 4000          // base entre envios WhatsApp
const BACKOFF_MIN = [5, 20, 60]   // minutos por tentativa (0,1,2)

function backoffISO(tentativas: number): string {
  const min = BACKOFF_MIN[Math.min(tentativas, BACKOFF_MIN.length - 1)]
  return new Date(Date.now() + min * 60_000).toISOString()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const nowISO = new Date().toISOString()

    async function invoke(fn: string, payload: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ ...payload, from_fila: true }),
      })
      const data = await r.json().catch(() => ({}))
      return { ok: r.ok, data }
    }

    async function marcarOk(id: string) {
      await admin.from('envio_fila').update({ status: 'enviado', updated_at: nowISO }).eq('id', id)
    }
    async function marcarFalha(id: string, tentativas: number, max: number, erro: string, permanente = false) {
      const novas = tentativas + 1
      const esgotou = permanente || novas >= max
      await admin.from('envio_fila').update({
        tentativas: novas,
        status: esgotou ? 'falhou' : 'pendente',
        proxima_em: esgotou ? nowISO : backoffISO(novas),
        ultimo_erro: erro.slice(0, 500),
        updated_at: nowISO,
      }).eq('id', id)
    }

    let emailsProcessados = 0
    let waProcessados = 0

    // ---- E-mail ----
    const { data: emails } = await admin
      .from('envio_fila')
      .select('*')
      .eq('canal', 'email')
      .eq('status', 'pendente')
      .lte('proxima_em', nowISO)
      .order('created_at')
      .limit(EMAIL_LOTE)

    for (const row of emails ?? []) {
      const { ok, data } = await invoke('send-email', row.payload as Record<string, unknown>)
      const sucesso = ok && Number((data as { ok?: number }).ok ?? 0) > 0
      if (sucesso) await marcarOk(row.id)
      else await marcarFalha(row.id, row.tentativas, row.max_tentativas, JSON.stringify(data))
      emailsProcessados++
    }

    // ---- WhatsApp (sequencial, com delay/jitter, teto baixo) ----
    const { data: was } = await admin
      .from('envio_fila')
      .select('*')
      .eq('canal', 'whatsapp')
      .eq('status', 'pendente')
      .lte('proxima_em', nowISO)
      .order('created_at')
      .limit(WA_LOTE)

    for (const row of was ?? []) {
      const { ok, data } = await invoke('whatsapp-send', row.payload as Record<string, unknown>)
      const d = data as { ok?: boolean; skipped?: boolean; reason?: string; error?: string }
      if (ok && d.ok) {
        await marcarOk(row.id)
      } else if (d.skipped || d.reason === 'numero_sem_whatsapp') {
        // Permanente: não adianta retentar (canal inativo ou número sem WhatsApp).
        await marcarFalha(row.id, row.tentativas, row.max_tentativas, d.reason ?? 'skipped', true)
      } else {
        await marcarFalha(row.id, row.tentativas, row.max_tentativas, d.error ?? JSON.stringify(data))
      }
      waProcessados++
      // Throttle anti-ban entre mensagens
      if (waProcessados < (was?.length ?? 0)) await sleep(WA_DELAY_MS + Math.floor((waProcessados % 3) * 1500))
    }

    return jsonResponse({ ok: true, emails: emailsProcessados, whatsapp: waProcessados })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
