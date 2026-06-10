import { supabase } from './supabase'

export type TemplateSlug =
  | 'multa-aplicada'
  | 'encomenda-chegou'
  | 'mural-nova-publicacao'
  | 'evento-lembrete'
  | 'custom'

export interface EmailVars {
  morador_nome?: string
  condominio_nome?: string
  valor?: number
  descricao?: string
  artigo?: string
  link?: string
  encomenda_tipo?: string
  codigo_retirada?: string
  publicacao_titulo?: string
  publicacao_conteudo?: string
  evento_titulo?: string
  evento_data?: string
  /** Nome do remetente. Se omitido, a edge resolve do perfil do chamador. */
  sender_name?: string | null
}

export interface SendEmailInput {
  to: string | string[]
  template: TemplateSlug
  vars?: EmailVars
  condominio_id?: string | null
  custom?: { subject: string; html: string; text?: string }
  reply_to?: string
  attachments?: Array<{ filename: string; content: string }>  // content = base64
}

export interface SendEmailResult {
  total: number
  ok: number
  fail: number
  results: Array<{ to: string; ok: boolean; id?: string; error?: string }>
}

/**
 * Envia e-mail via Edge Function send-email (que usa Resend).
 * Não bloqueia: se quiser fire-and-forget, ignore o retorno.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke('send-email', { body: input })
  if (error) throw error
  return data as SendEmailResult
}

/**
 * Lista logs de e-mails enviados (admin/sindico).
 */
export interface EmailLog {
  id: string
  condominio_id: string | null
  para: string
  assunto: string
  template_slug: string | null
  status: 'pending' | 'sent' | 'failed'
  resend_id: string | null
  erro: string | null
  tentativas: number
  created_at: string
  sent_at: string | null
}

export async function deleteEmailLog(id: string): Promise<void> {
  const { error } = await supabase.from('emails').delete().eq('id', id)
  if (error) throw error
}

export async function deleteEmailLogs(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { error, count } = await supabase
    .from('emails')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) throw error
  return count ?? 0
}

export async function listEmailLogs(opts: { condominio_id?: string; limit?: number } = {}): Promise<EmailLog[]> {
  let q = supabase
    .from('emails')
    .select('id,condominio_id,para,assunto,template_slug,status,resend_id,erro,tentativas,created_at,sent_at')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EmailLog[]
}
