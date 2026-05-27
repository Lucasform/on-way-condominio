// supabase/functions/notify-eventos-amanha/index.ts
// FASE 15 / Leva C — cron diário: dispara push pra moradores 24h antes do evento.
// Marca push_24h_at no evento pra não notificar duas vezes.
//
// Acionado pelo pg_cron via http_post (service_role no header).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Janela: eventos entre agora+23h e agora+25h que ainda não foram avisados.
    const agora = new Date()
    const ini = new Date(agora.getTime() + 23 * 60 * 60 * 1000).toISOString()
    const fim = new Date(agora.getTime() + 25 * 60 * 60 * 1000).toISOString()

    const { data: eventos, error } = await admin
      .from('eventos')
      .select('id, condominio_id, titulo, data_inicio, local, publico')
      .eq('ativo', true)
      .is('push_24h_at', null)
      .gte('data_inicio', ini)
      .lte('data_inicio', fim)
    if (error) throw error

    let totalPush = 0
    let eventosNotificados = 0
    for (const ev of eventos ?? []) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('user_id, perfis:user_id(condominio_id, role)')
        .eq('ativo', true)
      const userIds = new Set<string>()
      for (const s of subs ?? []) {
        const perfil = (s as { perfis?: { condominio_id: string | null; role: string } | null }).perfis
        if (!perfil) continue
        if (perfil.condominio_id !== ev.condominio_id) continue
        // Eventos não públicos só vão pra staff
        if (!ev.publico && perfil.role === 'morador') continue
        if (s.user_id) userIds.add(s.user_id as string)
      }
      if (userIds.size === 0) {
        await admin.from('eventos').update({ push_24h_at: agora.toISOString() }).eq('id', ev.id)
        continue
      }
      const dataFmt = new Date(ev.data_inicio as string).toLocaleString('pt-BR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            user_ids: Array.from(userIds),
            titulo: `📅 Amanhã: ${ev.titulo}`,
            corpo: `${dataFmt}${ev.local ? ` em ${ev.local}` : ''}.`,
            link: `/calendario`,
          }),
        })
        totalPush += userIds.size
      } catch (e) {
        console.warn('[notify-eventos-amanha] push falhou', e)
      }
      await admin.from('eventos').update({ push_24h_at: agora.toISOString() }).eq('id', ev.id)
      eventosNotificados += 1
    }

    return jsonResponse({ eventos: eventosNotificados, total_push: totalPush })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
