import { supabase } from './supabase'

export type CanalEnvio = 'email' | 'whatsapp'
export type StatusEnvio = 'pendente' | 'enviado' | 'falhou' | 'cancelado'

export interface EnvioFila {
  id: string
  condominio_id: string | null
  canal: CanalEnvio
  payload: Record<string, unknown>
  status: StatusEnvio
  tentativas: number
  max_tentativas: number
  proxima_em: string
  ultimo_erro: string | null
  created_at: string
  updated_at: string
}

export async function listEnvioFila(opts: {
  condominio_id?: string
  status?: StatusEnvio
  canal?: CanalEnvio
} = {}): Promise<EnvioFila[]> {
  let q = supabase.from('envio_fila').select('*').order('created_at', { ascending: false }).limit(200)
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.canal) q = q.eq('canal', opts.canal)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EnvioFila[]
}

/** Força o reprocesso de um item agora (zera tentativas, marca pendente). */
export async function reenviarEnvio(id: string): Promise<void> {
  const { error } = await supabase
    .from('envio_fila')
    .update({ status: 'pendente', tentativas: 0, proxima_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  // Dispara o reprocessador na hora (sem esperar o cron de 3min)
  supabase.functions.invoke('processar-envio-fila', { body: {} }).catch(() => {})
}

/** Reenvia todos os que falharam (do escopo filtrado). */
export async function reenviarFalhos(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('envio_fila')
    .update({ status: 'pendente', tentativas: 0, proxima_em: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
  supabase.functions.invoke('processar-envio-fila', { body: {} }).catch(() => {})
}

/** Destino legível a partir do payload. */
export function destinoEnvio(e: EnvioFila): string {
  const p = e.payload as { to?: string; telefone?: string }
  return (e.canal === 'email' ? p.to : p.telefone) ?? '—'
}

/** Traduz o erro técnico pra algo claro pro síndico. */
export function motivoEnvio(e: EnvioFila): string {
  const erro = (e.ultimo_erro ?? '').toLowerCase()
  if (e.canal === 'whatsapp') {
    if (erro.includes('sem_whatsapp') || erro.includes('exists') || erro.includes('não tem')) return 'Número não tem WhatsApp'
    if (erro.includes('skipped') || erro.includes('inativ') || erro.includes('não configurad')) return 'Canal WhatsApp desconectado'
    if (erro.includes('timeout') || erro.includes('econn') || erro.includes('fetch')) return 'Servidor WhatsApp indisponível no momento'
  } else {
    if (erro.includes('invalid') || erro.includes('422') || erro.includes('recus')) return 'E-mail recusado pelo provedor (endereço inválido?)'
    if (erro.includes('rate') || erro.includes('429')) return 'Limite do provedor de e-mail atingido'
  }
  if (e.status === 'pendente' && e.tentativas > 0) return 'Falha temporária — vai tentar de novo automaticamente'
  return e.ultimo_erro ? e.ultimo_erro.slice(0, 80) : 'Falha no envio'
}
