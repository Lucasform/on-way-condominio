import { supabase } from './supabase'
import type {
  Prestador,
  PrestadorInput,
  Servico,
  ServicoInput,
  StatusServico,
} from '../types/servico'

// ============================================================
// Prestadores
// ============================================================

export async function listPrestadores(opts: { condominio_id?: string; ativo?: boolean } = {}): Promise<Prestador[]> {
  let q = supabase.from('prestadores').select('*').order('nome')
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Prestador[]
}

export async function getPrestador(id: string): Promise<Prestador | null> {
  const { data, error } = await supabase.from('prestadores').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Prestador | null
}

export async function createPrestador(input: PrestadorInput): Promise<Prestador> {
  const { data, error } = await supabase
    .from('prestadores')
    .insert({
      ...input,
      nome: input.nome.trim(),
      telefone: trimOrNull(input.telefone),
      email: trimOrNull(input.email),
      documento: trimOrNull(input.documento),
      observacoes: trimOrNull(input.observacoes),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Prestador
}

export async function updatePrestador(id: string, input: PrestadorInput): Promise<Prestador> {
  const { data, error } = await supabase
    .from('prestadores')
    .update({
      ...input,
      nome: input.nome.trim(),
      telefone: trimOrNull(input.telefone),
      email: trimOrNull(input.email),
      documento: trimOrNull(input.documento),
      observacoes: trimOrNull(input.observacoes),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Prestador
}

export async function setPrestadorAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('prestadores').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deletePrestador(id: string): Promise<void> {
  const { error } = await supabase.from('prestadores').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// Serviços
// ============================================================

export async function listServicos(opts: {
  condominio_id?: string
  status?: StatusServico
  prestador_id?: string
} = {}): Promise<Servico[]> {
  let q = supabase.from('servicos').select('*').order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.prestador_id) q = q.eq('prestador_id', opts.prestador_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Servico[]
}

export async function getServico(id: string): Promise<Servico | null> {
  const { data, error } = await supabase.from('servicos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Servico | null
}

export async function createServico(input: ServicoInput): Promise<Servico> {
  const { data, error } = await supabase
    .from('servicos')
    .insert({
      ...input,
      titulo: input.titulo.trim(),
      descricao: trimOrNull(input.descricao),
      observacoes: trimOrNull(input.observacoes),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Servico
}

export async function updateServico(id: string, input: Partial<ServicoInput>): Promise<Servico> {
  const patch: Record<string, unknown> = { ...input }
  if (input.titulo !== undefined) patch.titulo = input.titulo.trim()
  if (input.descricao !== undefined) patch.descricao = trimOrNull(input.descricao)
  if (input.observacoes !== undefined) patch.observacoes = trimOrNull(input.observacoes)
  const { data, error } = await supabase
    .from('servicos')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Servico
}

export async function deleteServico(id: string): Promise<void> {
  const { error } = await supabase.from('servicos').delete().eq('id', id)
  if (error) throw error
}

function trimOrNull(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}
