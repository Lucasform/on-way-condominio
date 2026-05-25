import { supabase } from './supabase'
import type { Encomenda, EncomendaInput, StatusEncomenda } from '../types/encomenda'

export async function listEncomendas(opts: {
  condominio_id?: string
  status?: StatusEncomenda
  unidade_id?: string
} = {}): Promise<Encomenda[]> {
  let q = supabase.from('encomendas').select('*').order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.unidade_id) q = q.eq('unidade_id', opts.unidade_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Encomenda[]
}

export async function getEncomenda(id: string): Promise<Encomenda | null> {
  const { data, error } = await supabase
    .from('encomendas')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Encomenda | null
}

export async function createEncomenda(input: EncomendaInput, recebido_por: string): Promise<Encomenda> {
  const { data, error } = await supabase
    .from('encomendas')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id,
      pessoa_id: input.pessoa_id || null,
      tipo: input.tipo,
      transportadora: trimOrNull(input.transportadora),
      codigo_rastreio: trimOrNull(input.codigo_rastreio),
      descricao: trimOrNull(input.descricao),
      local_armazenamento: trimOrNull(input.local_armazenamento),
      foto_url: trimOrNull(input.foto_url),
      observacoes: trimOrNull(input.observacoes),
      recebido_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Encomenda
}

export async function darBaixaEncomenda(
  id: string,
  entregue_para: string,
  entregue_por: string,
): Promise<void> {
  const { error } = await supabase
    .from('encomendas')
    .update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
      entregue_para: entregue_para.trim(),
      entregue_por,
    })
    .eq('id', id)
  if (error) throw error
}

export async function devolverEncomenda(id: string): Promise<void> {
  const { error } = await supabase
    .from('encomendas')
    .update({ status: 'devolvida' })
    .eq('id', id)
  if (error) throw error
}

function trimOrNull(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}
