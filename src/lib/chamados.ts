import { supabase } from './supabase'
import type { Chamado, ChamadoInput, StatusChamado } from '../types/chamado'

export async function listChamados(opts: { condominio_id?: string; status?: StatusChamado } = {}): Promise<Chamado[]> {
  let q = supabase
    .from('chamados')
    .select('*')
    .order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Chamado[]
}

export async function getChamado(id: string): Promise<Chamado | null> {
  const { data, error } = await supabase.from('chamados').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Chamado | null
}

export async function createChamado(input: ChamadoInput, aberto_por: string): Promise<Chamado> {
  const { data, error } = await supabase
    .from('chamados')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id || null,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      categoria: input.categoria,
      prioridade: input.prioridade,
      aberto_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Chamado
}

export async function updateChamadoStatus(
  id: string,
  newStatus: StatusChamado,
  resolucao_nota?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'resolvido' || newStatus === 'finalizado') {
    // Marca timestamp do encerramento se ainda não estiver setado
    patch.resolvido_em = new Date().toISOString()
    if (resolucao_nota) patch.resolucao_nota = resolucao_nota.trim()
  }
  const { error } = await supabase.from('chamados').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChamado(id: string): Promise<void> {
  const { error } = await supabase.from('chamados').delete().eq('id', id)
  if (error) throw error
}
