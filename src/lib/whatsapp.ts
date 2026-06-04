import { supabase } from './supabase'
import type { WhatsappConfig, WhatsappConfigInput } from '../types/whatsapp'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function getWhatsappConfig(condominio_id: string): Promise<WhatsappConfig | null> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('condominio_id', condominio_id)
    .maybeSingle()
  if (error) throw error
  return data as WhatsappConfig | null
}

export async function upsertWhatsappConfig(input: WhatsappConfigInput): Promise<WhatsappConfig> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .upsert(
      {
        condominio_id: input.condominio_id,
        provider: input.provider,
        api_url: input.api_url.trim() || null,
        instance_id: input.instance_id.trim() || null,
        api_token: input.api_token.trim() || null,
        numero_envio: input.numero_envio.replace(/\D/g, '') || null,
        ativo: input.ativo,
      },
      { onConflict: 'condominio_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data as WhatsappConfig
}

/**
 * URL pública do webhook (cliente passa pro Z-API/Evolution colar).
 */
export function buildWebhookUrl(secret: string): string {
  return `${SUPABASE_URL}/functions/v1/whatsapp-webhook?secret=${secret}`
}

/**
 * Envia mensagem WhatsApp. Faz fire-and-forget; se config não estiver
 * ativa, a Edge Function retorna `skipped:true` silenciosamente.
 */
export interface SendWaInput {
  condominio_id: string
  telefone: string
  texto: string
  conversa_id?: string
}

export interface SendWaResult {
  ok?: boolean
  skipped?: boolean
  reason?: string
  error?: string
}

export async function sendWhatsApp(input: SendWaInput): Promise<SendWaResult> {
  const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: input })
  if (error) {
    console.warn('[whatsapp-send] erro:', error.message)
    return { ok: false, error: error.message }
  }
  return (data ?? {}) as SendWaResult
}

// ============================================================
// Provisionamento da instância (Evolution) — QR self-service
// ============================================================
export type WaAction = 'connect' | 'status' | 'logout' | 'delete'

export interface WaInstanceResult {
  ok?: boolean
  status?: string // 'open' | 'connecting' | 'close'
  conectado?: boolean
  qr_base64?: string | null
  pairing_code?: string | null
  instance?: string
  error?: string
}

/**
 * Cria/consulta/desconecta a instância WhatsApp do condomínio no servidor
 * Evolution único. `connect` devolve o QR (base64) pra escanear.
 */
export async function whatsappInstance(condominio_id: string, action: WaAction): Promise<WaInstanceResult> {
  const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
    body: { condominio_id, action },
  })
  if (error) return { ok: false, error: error.message }
  return (data ?? {}) as WaInstanceResult
}
