import { supabase } from './supabase'

// I2: centralised audit helper — fire-and-forget, never throws.
// Call from any mutation that should leave an audit trail.
// Backend/Edge Functions can call the same audit_log table directly.
export function logAction(entry: {
  acao: string
  alvo_tipo?: string
  alvo_id?: string
  condominio_id?: string
  detalhes?: Record<string, unknown>
}): void {
  supabase
    .from('audit_log')
    .insert({
      acao: entry.acao,
      alvo_tipo: entry.alvo_tipo ?? null,
      alvo_id: entry.alvo_id ?? null,
      condominio_id: entry.condominio_id ?? null,
      detalhes: entry.detalhes ?? {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    .then(({ error }) => {
      if (error) console.warn('[logAction]', error.message)
    })
}
