// supabase/functions/notify-encomendas-paradas/index.ts
// FASE 15 / Leva C — cron diário.
// Alerta staff (síndico, subsíndico, administradora, portaria) sobre encomendas
// aguardando retirada há mais de 7 dias.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STAFF_ROLES = ['sindico', 'subsindico', 'administradora', 'portaria']

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: encs, error } = await admin
      .from('encomendas')
      .select('id, condominio_id, descricao, created_at, unidade_id, unidades:unidade_id(bloco, numero)')
      .eq('status', 'aguardando')
      .lte('created_at', limite)
      .is('push_alerta_at', null)
    if (error) throw error

    let total = 0
    for (const e of encs ?? []) {
      // Resolve staff do condomínio com push ativo
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('user_id, perfis:user_id(condominio_id, role, ativo)')
        .eq('ativo', true)
      const userIds = new Set<string>()
      for (const s of subs ?? []) {
        const perfil = (s as { perfis?: { condominio_id: string | null; role: string; ativo: boolean } | null }).perfis
        if (!perfil?.ativo) continue
        if (perfil.condominio_id !== e.condominio_id) continue
        if (!STAFF_ROLES.includes(perfil.role)) continue
        if (s.user_id) userIds.add(s.user_id as string)
      }
      if (userIds.size > 0) {
        const u = (e as { unidades?: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null }).unidades
        const uFlat = Array.isArray(u) ? u[0] : u
        const unidadeStr = uFlat ? (uFlat.bloco ? `${uFlat.bloco}-${uFlat.numero}` : uFlat.numero) : 's/un'
        const dias = Math.floor((Date.now() - new Date(e.created_at as string).getTime()) / (24 * 60 * 60 * 1000))
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({
              user_ids: Array.from(userIds),
              titulo: `📦 Encomenda parada há ${dias} dias`,
              corpo: `Unidade ${unidadeStr}${e.descricao ? `: ${String(e.descricao).slice(0, 80)}` : ''}`,
              link: `/encomendas/${e.id}`,
            }),
          })
          total += 1
        } catch (err) {
          console.warn('[notify-encomendas-paradas] push falhou', err)
        }
        // Alerta interno (sininho) pros mesmos staff
        const alertas = Array.from(userIds).map((uid) => ({
          user_id: uid, condominio_id: e.condominio_id, tipo: 'encomenda_parada',
          titulo: `Encomenda parada há ${dias} dias`,
          conteudo: `Unidade ${unidadeStr}${e.descricao ? `: ${String(e.descricao).slice(0, 80)}` : ''}`,
          link: `/encomendas/${e.id}`,
        }))
        if (alertas.length > 0) await admin.from('app_notifications').insert(alertas)
      }
      await admin.from('encomendas').update({ push_alerta_at: new Date().toISOString() }).eq('id', e.id)
    }

    return jsonResponse({ encomendas_alertadas: total })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
