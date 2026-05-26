import { supabase } from './supabase'

// Chave VAPID PÚBLICA. Pode ser pública (vai pro client de qualquer jeito).
const VAPID_PUBLIC = 'BC4EAcYmeabLAthdCZmWTF3eF3B1TaPzhiT10TLcIJ0viB0oSJM4byD3oGNPgiFPa8uOuu-6E10KITs747Z6V0Y'

export interface PushStatus {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) {
    return { supported: false, permission: 'default', subscribed: false }
  }
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!sub,
  }
}

/**
 * Ativa push: registra SW, pede permissão, faz subscribe, salva no banco.
 * Retorna true se subscrito com sucesso, false se permissão negada.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) throw new Error('Push não suportado neste navegador.')

  // 1) Registra service worker
  const reg = await navigator.serviceWorker.register('/sw.js')

  // 2) Pede permissão
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  // 3) Subscribe via Push API
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  })

  // 4) Salva no banco (upsert por endpoint)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const subJson = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh,
        auth: subJson.keys!.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        ativo: true,
      },
      { onConflict: 'user_id,endpoint' },
    )
  if (error) throw error

  return true
}

/**
 * Desativa push: unsubscribe + marca inativo no banco.
 */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase
      .from('push_subscriptions')
      .update({ ativo: false })
      .eq('endpoint', endpoint)
  }
}

/**
 * Dispara push pra lista de users via Edge Function.
 * Fire-and-forget recomendado nos call sites.
 */
export interface SendPushInput {
  user_ids: string[]
  titulo: string
  corpo?: string
  link?: string
}

export async function sendPush(input: SendPushInput): Promise<void> {
  if (input.user_ids.length === 0) return
  const { error } = await supabase.functions.invoke('send-push', { body: input })
  if (error) throw error
}

// ----------------------------------------------------------------
// VAPID public key (base64url) -> Uint8Array (formato do Push API)
// ----------------------------------------------------------------
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) view[i] = rawData.charCodeAt(i)
  return buffer
}
