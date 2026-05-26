import { supabase } from './supabase'
import type { Encomenda, EncomendaInput, StatusEncomenda } from '../types/encomenda'
import { sendEmail } from './email'
import { sendPush } from './push'

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
  const encomenda = data as Encomenda

  // Dispara e-mail pro morador (fire-and-forget). Etapa 61.
  notifyMoradorEncomenda(encomenda).catch((e) =>
    console.warn('[encomenda] falha ao enviar e-mail:', e.message),
  )
  return encomenda
}

async function notifyMoradorEncomenda(encomenda: Encomenda): Promise<void> {
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('nome, email, user_id')
    .eq('unidade_id', encomenda.unidade_id)
    .eq('ativo', true)

  const moradores = pessoas ?? []
  if (moradores.length === 0) return

  const { data: condo } = await supabase
    .from('condominios')
    .select('nome')
    .eq('id', encomenda.condominio_id)
    .maybeSingle()

  // E-mail
  const emails = moradores.map((p) => p.email).filter((e): e is string => !!e)
  if (emails.length > 0) {
    sendEmail({
      to: emails,
      template: 'encomenda-chegou',
      condominio_id: encomenda.condominio_id,
      vars: {
        condominio_nome: condo?.nome ?? undefined,
        encomenda_tipo: encomenda.tipo,
        descricao: encomenda.descricao ?? undefined,
        link: `${window.location.origin}/encomendas/${encomenda.id}`,
      },
    }).catch((e) => console.warn('[encomenda] email falhou:', e.message))
  }

  // Push
  const userIds = moradores.map((p) => p.user_id).filter((u): u is string => !!u)
  if (userIds.length > 0) {
    const titulo = encomenda.tipo === 'comida' ? '🍔 Sua comida chegou' : '📦 Encomenda na portaria'
    sendPush({
      user_ids: userIds,
      titulo,
      corpo: encomenda.descricao ?? 'Retire na portaria.',
      link: `/encomendas/${encomenda.id}`,
    }).catch((e) => console.warn('[encomenda] push falhou:', e.message))
  }
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

export async function deleteEncomenda(id: string): Promise<void> {
  const { error } = await supabase.from('encomendas').delete().eq('id', id)
  if (error) throw error
}

function trimOrNull(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}
