import { supabase } from './supabase'
import type {
  Conversa,
  Mensagem,
  AssuntoConversa,
  StatusConversa,
} from '../types/chat'

export const ASSUNTO_LABEL: Record<AssuntoConversa, string> = {
  multa: '💰 Sobre uma multa',
  encomenda: '📦 Sobre encomenda',
  manutencao: '🛠 Manutenção / problema',
  sugestao: '💡 Sugestão',
  outro: '💬 Outro assunto',
}

export const STATUS_LABEL: Record<StatusConversa, string> = {
  aberta: 'Aberta',
  aguardando_humano: 'Aguardando atendimento',
  em_atendimento: 'Em atendimento',
  encerrada: 'Encerrada',
}

export async function listConversas(opts: { condominio_id?: string; status?: StatusConversa } = {}): Promise<Conversa[]> {
  let q = supabase
    .from('conversas')
    .select('*')
    .order('ultima_mensagem_at', { ascending: false, nullsFirst: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Conversa[]
}

export async function getConversa(id: string): Promise<Conversa | null> {
  const { data, error } = await supabase.from('conversas').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Conversa | null
}

export async function listMensagens(conversa_id: string): Promise<Mensagem[]> {
  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .eq('conversa_id', conversa_id)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Mensagem[]
}

export async function createConversa(input: {
  condominio_id: string
  morador_user_id: string
  assunto: AssuntoConversa
  primeira_mensagem: string
}): Promise<Conversa> {
  const { data: conv, error: cErr } = await supabase
    .from('conversas')
    .insert({
      condominio_id: input.condominio_id,
      morador_user_id: input.morador_user_id,
      assunto: input.assunto,
      status: 'aberta',
    })
    .select('*')
    .single()
  if (cErr) throw cErr

  // Primeira mensagem do morador
  const conversa = conv as Conversa
  await supabase.from('mensagens').insert({
    conversa_id: conversa.id,
    autor_id: input.morador_user_id,
    autor_tipo: 'morador',
    conteudo: input.primeira_mensagem.trim(),
  })

  return conversa
}

export async function enviarMensagem(input: {
  conversa_id: string
  autor_id: string
  autor_tipo: 'morador' | 'staff'
  conteudo: string
}): Promise<void> {
  const { error } = await supabase.from('mensagens').insert({
    conversa_id: input.conversa_id,
    autor_id: input.autor_id,
    autor_tipo: input.autor_tipo,
    conteudo: input.conteudo.trim(),
  })
  if (error) throw error
}

export async function mudarStatusConversa(id: string, status: StatusConversa, atribuida_para?: string | null): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (atribuida_para !== undefined) patch.atribuida_para = atribuida_para
  const { error } = await supabase.from('conversas').update(patch).eq('id', id)
  if (error) throw error
}
