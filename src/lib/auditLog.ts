import { supabase } from './supabase'

export interface AuditEntry {
  id: number
  ator_id: string | null
  ator_role: string | null
  ator_email: string | null
  condominio_id: string | null
  acao: string
  alvo_tipo: string | null
  alvo_id: string | null
  detalhes: Record<string, unknown>
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditFilter {
  condominio_id?: string
  acao?: string
  ator_id?: string
  alvo_tipo?: string
  desde?: string         // ISO
  ate?: string           // ISO
  limit?: number
}

export async function listAudit(filter: AuditFilter = {}): Promise<AuditEntry[]> {
  let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false })
  if (filter.condominio_id) q = q.eq('condominio_id', filter.condominio_id)
  if (filter.acao) q = q.eq('acao', filter.acao)
  if (filter.ator_id) q = q.eq('ator_id', filter.ator_id)
  if (filter.alvo_tipo) q = q.eq('alvo_tipo', filter.alvo_tipo)
  if (filter.desde) q = q.gte('created_at', filter.desde)
  if (filter.ate) q = q.lte('created_at', filter.ate)
  q = q.limit(filter.limit ?? 200)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AuditEntry[]
}
