import { supabase } from './supabase'
import type { Unidade, UnidadeInput } from '../types/unidade'
import { cacheGet, cacheSet, cacheInvalidate } from './cache'

const CACHE_TTL = 60_000
const CACHE_KEY = 'unidades:all'

export async function listUnidades(opts: { condominio_id?: string; ativo?: boolean } = {}): Promise<Unidade[]> {
  const noOpts = !opts.condominio_id && opts.ativo === undefined
  if (noOpts) {
    const cached = cacheGet<Unidade[]>(CACHE_KEY)
    if (cached) return cached
  }
  let q = supabase
    .from('unidades')
    .select('*')
    .order('bloco', { ascending: true, nullsFirst: true })
    .order('numero', { ascending: true })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  const result = (data ?? []) as Unidade[]
  if (noOpts) cacheSet(CACHE_KEY, result, CACHE_TTL)
  return result
}

export function invalidateUnidadesCache(): void {
  cacheInvalidate('unidades:')
}

export async function getUnidade(id: string): Promise<Unidade | null> {
  const { data, error } = await supabase
    .from('unidades')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Unidade | null
}

export async function createUnidade(input: UnidadeInput): Promise<Unidade> {
  const { data, error } = await supabase
    .from('unidades')
    .insert(normalize(input))
    .select('*')
    .single()
  if (error) throw error
  return data as Unidade
}

export async function updateUnidade(id: string, input: UnidadeInput): Promise<Unidade> {
  const { data, error } = await supabase
    .from('unidades')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Unidade
}

export async function setUnidadeAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('unidades').update({ ativo }).eq('id', id)
  if (error) throw error
}

// Hard delete — pode falhar se houver registros relacionados sem cascade.
// RLS permite admin_onway + sindico (alinhado ao padrão geral).
export async function deleteUnidade(id: string): Promise<void> {
  const { error } = await supabase.from('unidades').delete().eq('id', id)
  if (error) throw error
}

function normalize(input: UnidadeInput): UnidadeInput {
  return {
    condominio_id: input.condominio_id,
    bloco: input.bloco?.trim() || null,
    numero: input.numero.trim(),
    tipo: input.tipo,
    area_m2: input.area_m2 != null && !Number.isNaN(input.area_m2) ? input.area_m2 : null,
  }
}
