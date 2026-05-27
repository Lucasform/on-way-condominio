import { supabase } from './supabase'
import type { Evento, EventoInput } from '../types/evento'
import { sendEmail } from './email'

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
  // Pega o user atual pra preencher criado_por (a coluna tem default
  // '00000000-...' que e FK invalida pra auth.users).
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null
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
      ...(userId ? { criado_por: userId } : {}),
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

/**
 * Envia lembrete por e-mail pros moradores do condomínio sobre um evento.
 * Etapa 70 do ROADMAP.
 */
export async function enviarLembreteEvento(eventoId: string): Promise<{ enviados: number; falhas: number }> {
  const ev = await getEvento(eventoId)
  if (!ev) throw new Error('Evento não encontrado.')

  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('email')
    .eq('condominio_id', ev.condominio_id)
    .eq('ativo', true)
    .not('email', 'is', null)

  const emails = (pessoas ?? []).map((p) => p.email!).filter(Boolean)
  if (emails.length === 0) return { enviados: 0, falhas: 0 }

  const { data: condo } = await supabase
    .from('condominios')
    .select('nome')
    .eq('id', ev.condominio_id)
    .maybeSingle()

  const dataLegivel = new Date(ev.data_inicio).toLocaleString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const result = await sendEmail({
    to: emails,
    template: 'evento-lembrete',
    condominio_id: ev.condominio_id,
    vars: {
      condominio_nome: condo?.nome ?? undefined,
      evento_titulo: ev.titulo,
      evento_data: dataLegivel,
      descricao: ev.descricao ?? undefined,
      link: `${window.location.origin}/calendario`,
    },
  })

  return { enviados: result.ok, falhas: result.fail }
}
