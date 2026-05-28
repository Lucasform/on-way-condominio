import { supabase } from './supabase'
import type { Pet, PetInput } from '../types/pet'

export async function listPets(opts: { condominio_id?: string; ativo?: boolean } = {}): Promise<Pet[]> {
  let q = supabase.from('pets').select('*').order('nome', { ascending: true })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Pet[]
}

export async function getPet(id: string): Promise<Pet | null> {
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Pet | null
}

export async function createPet(input: PetInput): Promise<Pet> {
  const { data, error } = await supabase
    .from('pets')
    .insert(normalize(input))
    .select('*')
    .single()
  if (error) throw error
  return data as Pet
}

export async function updatePet(id: string, input: PetInput): Promise<Pet> {
  const { data, error } = await supabase
    .from('pets')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Pet
}

export async function setPetAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('pets').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from('pets').delete().eq('id', id)
  if (error) throw error
}

function normalize(input: PetInput): PetInput {
  return {
    condominio_id: input.condominio_id,
    unidade_id: input.unidade_id,
    pessoa_id: input.pessoa_id || null,
    nome: input.nome.trim(),
    especie: input.especie,
    raca: trimOrNull(input.raca),
    porte: input.porte || null,
    foto_url: trimOrNull(input.foto_url),
    vacinacao_em_dia: !!input.vacinacao_em_dia,
    data_vacina_antirabica: input.data_vacina_antirabica || null,
    observacoes: trimOrNull(input.observacoes),
  }
}

function trimOrNull(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}
