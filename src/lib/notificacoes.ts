import { supabase } from './supabase'
import type { Notificacao, NotificacaoInput, StatusNotificacao } from '../types/notificacao'

export const NOTIFICACAO_STATUS_LABEL: Record<StatusNotificacao, string> = {
  pendente:     'Pendente',
  enviada:      'Enviada',
  ciente:       'Ciente',
  contestada:   'Contestada',
  advertencia:  'Advertência aplicada',
  multa_gerada: 'Multa gerada',
  arquivada:    'Arquivada',
  cancelada:    'Cancelada',
}

// Transições simples de acompanhamento (o desfecho final tem botões próprios).
export const NOTIFICACAO_STATUS_TRANSITIONS: Record<StatusNotificacao, StatusNotificacao[]> = {
  pendente:     ['enviada', 'cancelada'],
  enviada:      ['ciente', 'contestada'],
  ciente:       ['contestada'],
  contestada:   [],
  advertencia:  [],
  multa_gerada: [],
  arquivada:    [],
  cancelada:    [],
}

// Status terminais (desfecho decidido)
export const NOTIFICACAO_STATUS_TERMINAL: StatusNotificacao[] = [
  'advertencia', 'multa_gerada', 'arquivada', 'cancelada',
]

/** Aplica advertência (desfecho sem valor). */
export async function aplicarAdvertencia(id: string): Promise<Notificacao> {
  return changeNotificacaoStatus(id, 'advertencia')
}

/** Marca que a notificação virou multa (após criar a multa). */
export async function vincularMultaNotificacao(id: string, multa_id: string): Promise<void> {
  const { error } = await supabase
    .from('notificacoes')
    .update({ status: 'multa_gerada', multa_id })
    .eq('id', id)
  if (error) throw error
}

export async function listNotificacoes(opts: {
  condominio_id?: string
  unidade_id?: string
  pessoa_id?: string
  status?: StatusNotificacao
} = {}): Promise<Notificacao[]> {
  let q = supabase.from('notificacoes').select('*').order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.unidade_id) q = q.eq('unidade_id', opts.unidade_id)
  if (opts.pessoa_id) q = q.eq('pessoa_id', opts.pessoa_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Notificacao[]
}

export async function getNotificacao(id: string): Promise<Notificacao | null> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Notificacao | null
}

export async function createNotificacao(input: NotificacaoInput, emitida_por: string): Promise<Notificacao> {
  const { data, error } = await supabase
    .from('notificacoes')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id,
      pessoa_id: input.pessoa_id || null,
      ocorrencia_id: input.ocorrencia_id || null,
      emitida_por,
      assunto: input.assunto.trim(),
      descricao: input.descricao.trim(),
      artigo_regimento: input.artigo_regimento?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Notificacao
}

export async function changeNotificacaoStatus(id: string, status: StatusNotificacao): Promise<Notificacao> {
  const patch: Partial<Notificacao> = { status }
  if (status === 'enviada') patch.data_envio = new Date().toISOString()
  if (status === 'ciente') patch.data_ciencia = new Date().toISOString()

  const { data, error } = await supabase
    .from('notificacoes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Notificacao
}

// Exclusão definitiva — RLS já restringe a admin_onway.
export async function deleteNotificacao(id: string): Promise<void> {
  const { error } = await supabase.from('notificacoes').delete().eq('id', id)
  if (error) throw error
}

export async function updateNotificacao(id: string, patch: Partial<NotificacaoInput>): Promise<Notificacao> {
  const upd: Record<string, unknown> = {}
  if (patch.assunto !== undefined) upd.assunto = patch.assunto.trim()
  if (patch.descricao !== undefined) upd.descricao = patch.descricao.trim()
  if (patch.artigo_regimento !== undefined) upd.artigo_regimento = patch.artigo_regimento?.trim() || null
  if (patch.observacoes !== undefined) upd.observacoes = patch.observacoes?.trim() || null
  const { data, error } = await supabase
    .from('notificacoes')
    .update(upd)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Notificacao
}
