// supabase/functions/send-push/index.ts
// Envia Web Push notification via protocolo W3C (lib web-push do npm).
//
// Body: { user_ids: uuid[], titulo: string, corpo?: string, link?: string, icon?: string }
// Auth: JWT válido.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'
// @ts-expect-error: npm import via Deno
import webpush from 'npm:web-push@3.6.7'

interface Body {
  user_ids: string[]
  titulo: string
  corpo?: string
  link?: string
  icon?: string
  badge?: string
}

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@onwaytech.com.br'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return jsonResponse({ error: 'VAPID keys não configuradas.' }, 500)
    }

    const body = (await req.json()) as Body
    if (!body.user_ids || body.user_ids.length === 0) {
      return jsonResponse({ error: 'user_ids obrigatório.' }, 400)
    }
    if (!body.titulo) return jsonResponse({ error: 'titulo obrigatório.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Busca subscriptions ativas dos users alvo
    const { data: subs, error: sErr } = await admin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', body.user_ids)
      .eq('ativo', true)
    if (sErr) return jsonResponse({ error: sErr.message }, 500)

    const payload = JSON.stringify({
      titulo: body.titulo,
      corpo: body.corpo ?? '',
      link: body.link ?? '/',
      icon: body.icon ?? '/favicon.svg',
      badge: body.badge ?? '/favicon.svg',
    })

    let ok = 0
    let fail = 0
    const expired: string[] = []

    for (const s of subs ?? []) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 })
        ok++
      } catch (e: unknown) {
        fail++
        const code = (e as { statusCode?: number })?.statusCode
        // 404/410 = subscription expirou (browser desinstalado, etc)
        if (code === 404 || code === 410) {
          expired.push(s.id)
        }
      }
    }

    // Desativa subscriptions expiradas
    if (expired.length > 0) {
      await admin
        .from('push_subscriptions')
        .update({ ativo: false })
        .in('id', expired)
    }

    return jsonResponse({
      total: subs?.length ?? 0,
      ok,
      fail,
      desativadas: expired.length,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
