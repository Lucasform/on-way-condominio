import { supabase } from './supabase'
import type {
  AgregadoAvaliacao,
  FornecedorAvaliacao,
  FornecedorAvaliacaoInput,
} from '../types/fornecedorAvaliacao'

export async function listAvaliacoes(fornecedor_ids: string[]): Promise<FornecedorAvaliacao[]> {
  if (fornecedor_ids.length === 0) return []
  const { data, error } = await supabase
    .from('fornecedor_avaliacoes')
    .select('*')
    .in('fornecedor_id', fornecedor_ids)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FornecedorAvaliacao[]
}

export function agregar(rows: FornecedorAvaliacao[]): Record<string, AgregadoAvaliacao> {
  const buckets: Record<string, number[]> = {}
  for (const r of rows) {
    if (!buckets[r.fornecedor_id]) buckets[r.fornecedor_id] = []
    buckets[r.fornecedor_id].push(r.estrelas)
  }
  const out: Record<string, AgregadoAvaliacao> = {}
  for (const [k, arr] of Object.entries(buckets)) {
    const total = arr.length
    const soma = arr.reduce((a, b) => a + b, 0)
    out[k] = { total, media: total > 0 ? soma / total : 0 }
  }
  return out
}

export async function upsertAvaliacao(input: FornecedorAvaliacaoInput): Promise<FornecedorAvaliacao> {
  const { data: userData } = await supabase.auth.getUser()
  const user_id = userData.user?.id
  if (!user_id) throw new Error('Usuário não autenticado.')
  const { data, error } = await supabase
    .from('fornecedor_avaliacoes')
    .upsert(
      {
        fornecedor_id: input.fornecedor_id,
        condominio_id: input.condominio_id,
        user_id,
        estrelas: input.estrelas,
        comentario: input.comentario?.trim() || null,
      },
      { onConflict: 'fornecedor_id,user_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data as FornecedorAvaliacao
}

export async function deleteAvaliacao(id: string): Promise<void> {
  const { error } = await supabase.from('fornecedor_avaliacoes').delete().eq('id', id)
  if (error) throw error
}
