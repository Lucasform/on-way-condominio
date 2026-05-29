import { supabase } from './supabase'
import type {
  CondominioFornecedor,
  CondominioFornecedorInput,
  StatusFornecedor,
  TipoFornecedor,
} from '../types/condominioFornecedor'

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length ? t : null
}

export async function listFornecedores(opts: {
  condominio_id?: string
  tipo?: TipoFornecedor
  status?: StatusFornecedor
} = {}): Promise<CondominioFornecedor[]> {
  let q = supabase
    .from('condominio_fornecedores')
    .select('*')
    .order('created_at', { ascending: false })

  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.tipo) q = q.eq('tipo', opts.tipo)
  if (opts.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CondominioFornecedor[]
}

export async function getFornecedor(id: string): Promise<CondominioFornecedor | null> {
  const { data, error } = await supabase
    .from('condominio_fornecedores')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as CondominioFornecedor | null
}

export async function createFornecedor(
  input: CondominioFornecedorInput,
  cadastrado_por: string,
): Promise<CondominioFornecedor> {
  const { data, error } = await supabase
    .from('condominio_fornecedores')
    .insert({
      condominio_id: input.condominio_id,
      nome: input.nome.trim(),
      tipo: input.tipo,
      servico: trimOrNull(input.servico ?? null),
      telefone: trimOrNull(input.telefone ?? null),
      email: trimOrNull(input.email ?? null),
      documento: trimOrNull(input.documento ?? null),
      foto_url: trimOrNull(input.foto_url ?? null),
      agenda: input.agenda ?? null,
      unidade_id: input.unidade_id ?? null,
      observacoes: trimOrNull(input.observacoes ?? null),
      cadastrado_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CondominioFornecedor
}

export async function updateFornecedor(
  id: string,
  patch: Partial<CondominioFornecedorInput>,
): Promise<CondominioFornecedor> {
  const upd: Record<string, unknown> = {}
  if (patch.nome !== undefined) upd.nome = patch.nome.trim()
  if (patch.tipo !== undefined) upd.tipo = patch.tipo
  if (patch.servico !== undefined) upd.servico = trimOrNull(patch.servico)
  if (patch.telefone !== undefined) upd.telefone = trimOrNull(patch.telefone)
  if (patch.email !== undefined) upd.email = trimOrNull(patch.email)
  if (patch.documento !== undefined) upd.documento = trimOrNull(patch.documento)
  if (patch.foto_url !== undefined) upd.foto_url = trimOrNull(patch.foto_url)
  if (patch.agenda !== undefined) upd.agenda = patch.agenda
  if (patch.unidade_id !== undefined) upd.unidade_id = patch.unidade_id
  if (patch.observacoes !== undefined) upd.observacoes = trimOrNull(patch.observacoes)
  const { data, error } = await supabase
    .from('condominio_fornecedores')
    .update(upd)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CondominioFornecedor
}

export async function aprovarFornecedor(id: string, aprovado_por: string): Promise<void> {
  const { error } = await supabase
    .from('condominio_fornecedores')
    .update({
      status: 'aprovado',
      aprovado_por,
      aprovado_em: new Date().toISOString(),
      motivo_recusa: null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function recusarFornecedor(
  id: string,
  aprovado_por: string,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase
    .from('condominio_fornecedores')
    .update({
      status: 'recusado',
      aprovado_por,
      aprovado_em: new Date().toISOString(),
      motivo_recusa: trimOrNull(motivo ?? null),
    })
    .eq('id', id)
  if (error) throw error
}

export async function inativarFornecedor(id: string): Promise<void> {
  const { error } = await supabase
    .from('condominio_fornecedores')
    .update({ status: 'inativo' })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFornecedor(id: string): Promise<void> {
  const { error } = await supabase
    .from('condominio_fornecedores')
    .delete()
    .eq('id', id)
  if (error) throw error
}
