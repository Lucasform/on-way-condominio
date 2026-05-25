import { supabase } from './supabase'
import type { Multa, MultaInput, StatusMulta } from '../types/multa'

export async function listMultas(opts: {
  condominio_id?: string
  unidade_id?: string
  pessoa_id?: string
  status?: StatusMulta
} = {}): Promise<Multa[]> {
  let q = supabase.from('multas').select('*').order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.unidade_id) q = q.eq('unidade_id', opts.unidade_id)
  if (opts.pessoa_id) q = q.eq('pessoa_id', opts.pessoa_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Multa[]
}

export async function getMulta(id: string): Promise<Multa | null> {
  const { data, error } = await supabase
    .from('multas')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Multa | null
}

export async function getMultaByOcorrencia(ocorrenciaId: string): Promise<Multa | null> {
  const { data, error } = await supabase
    .from('multas')
    .select('*')
    .eq('ocorrencia_id', ocorrenciaId)
    .maybeSingle()
  if (error) throw error
  return data as Multa | null
}

export async function createMulta(input: MultaInput, aplicada_por: string): Promise<Multa> {
  const { data, error } = await supabase
    .from('multas')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id,
      pessoa_id: input.pessoa_id || null,
      ocorrencia_id: input.ocorrencia_id || null,
      valor: input.valor,
      artigo_regimento: input.artigo_regimento?.trim() || null,
      descricao: input.descricao.trim(),
      observacoes: input.observacoes?.trim() || null,
      status: 'em_analise',
      aplicada_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Multa
}

/**
 * Cria uma multa a partir de uma ocorrência e atualiza a ocorrência
 * pra status `virou_multa`. Não é atômico (2 calls), mas em caso de
 * falha na 2ª chamada a multa fica criada (e a ocorrência mantém o
 * status antigo — fácil de detectar e corrigir manualmente).
 */
export async function createMultaFromOcorrencia(
  input: MultaInput,
  aplicada_por: string,
): Promise<Multa> {
  if (!input.ocorrencia_id) {
    throw new Error('ocorrencia_id é obrigatório nesta operação.')
  }
  const multa = await createMulta(input, aplicada_por)
  const { error: upErr } = await supabase
    .from('ocorrencias')
    .update({ status: 'virou_multa' })
    .eq('id', input.ocorrencia_id)
  if (upErr) {
    console.warn(
      `[multa] criada (${multa.id}) mas falhou ao atualizar ocorrência ${input.ocorrencia_id}: ${upErr.message}`,
    )
  }
  return multa
}
