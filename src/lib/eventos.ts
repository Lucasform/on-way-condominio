import { supabase } from './supabase'
import type { Evento, EventoInput } from '../types/evento'

export async function listEventos(opts: {
  condominio_id?: string
  desde?: string  // ISO
  ate?: string    // ISO
} = {}): Promise<Evento[]> {
  let q = supabase
    .from('eventos')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: true })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.desde) q = q.gte('data_inicio', opts.desde)
  if (opts.ate) q = q.lte('data_inicio', opts.ate)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Evento[]
}

export async function getEvento(id: string): Promise<Evento | null> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Evento | null
}

export async function createEvento(input: EventoInput): Promise<Evento> {
  const { data, error } = await supabase
    .from('eventos')
    .insert({
      condominio_id: input.condominio_id,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim || null,
      local: input.local?.trim() || null,
      tipo: input.tipo,
      publico: input.publico,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Evento
}

export async function updateEvento(id: string, input: EventoInput): Promise<Evento> {
  const { data, error } = await supabase
    .from('eventos')
    .update({
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim || null,
      local: input.local?.trim() || null,
      tipo: input.tipo,
      publico: input.publico,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Evento
}

export async function deleteEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').update({ ativo: false }).eq('id', id)
  if (error) throw error
}
