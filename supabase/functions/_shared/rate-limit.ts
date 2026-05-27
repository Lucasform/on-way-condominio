// supabase/functions/_shared/rate-limit.ts
// Rate limit das edges IA — 30 chamadas/hora/user.
// Usa RPC `ia_consume_rate_limit` (definida em 0060_ia_rate_limit.sql).

import { createClient } from 'jsr:@supabase/supabase-js@2'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset_at: string | null
}

/**
 * Tenta consumir uma chamada do rate limit do usuário.
 * Retorna { allowed: false } se passou do limite. Falha-aberto se não
 * conseguir resolver o user (ex: header malformado) — não bloqueia em erro.
 */
export async function consumeIaRateLimit(
  authHeader: string | null,
  limit = 30,
): Promise<RateLimitResult> {
  if (!authHeader) return { allowed: true, remaining: limit, reset_at: null }

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: who } = await userClient.auth.getUser()
    const uid = who?.user?.id
    if (!uid) return { allowed: true, remaining: limit, reset_at: null }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data, error } = await admin.rpc('ia_consume_rate_limit', {
      p_user_id: uid,
      p_limit: limit,
    })
    if (error) {
      console.warn('[rate-limit] RPC falhou (fail-open):', error.message)
      return { allowed: true, remaining: limit, reset_at: null }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { allowed: true, remaining: limit, reset_at: null }
    return {
      allowed: !!row.allowed,
      remaining: Number(row.remaining ?? 0),
      reset_at: row.reset_at ?? null,
    }
  } catch (e) {
    console.warn('[rate-limit] erro (fail-open):', e)
    return { allowed: true, remaining: limit, reset_at: null }
  }
}
