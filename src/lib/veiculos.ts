import { supabase } from './supabase'
import type { Veiculo, VeiculoInput } from '../types/veiculo'

export async function listVeiculos(opts: { condominio_id?: string; ativo?: boolean } = {}): Promise<Veiculo[]> {
  let q = supabase.from('veiculos').select('*').order('placa', { ascending: true })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Veiculo[]
}

export async function getVeiculo(id: string): Promise<Veiculo | null> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Veiculo | null
}

export async function createVeiculo(input: VeiculoInput): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .insert(normalize(input))
    .select('*')
    .single()
  if (error) throw error
  return data as Veiculo
}

export async function updateVeiculo(id: string, input: VeiculoInput): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Veiculo
}

export async function setVeiculoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('veiculos').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deleteVeiculo(id: string): Promise<void> {
  const { error } = await supabase.from('veiculos').delete().eq('id', id)
  if (error) throw error
}

function normalize(input: VeiculoInput): VeiculoInput {
  return {
    condominio_id: input.condominio_id,
    unidade_id: input.unidade_id,
    pessoa_id: input.pessoa_id || null,
    placa: (input.placa || '').replace(/\s/g, '').toUpperCase(),
    modelo: trimOrNull(input.modelo),
    cor: trimOrNull(input.cor),
    tipo: input.tipo,
    vaga: trimOrNull(input.vaga),
  }
}

function trimOrNull(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}
