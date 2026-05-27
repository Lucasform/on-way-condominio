import { supabase } from './supabase'
import type {
  Conversa,
  Mensagem,
  AssuntoConversa,
  StatusConversa,
} from '../types/chat'
import { sendPush } from './push'

export const ASSUNTO_LABEL: Record<AssuntoConversa, string> = {
  multa: '💰 Multa',
  encomenda: '📦 Encomenda',
  manutencao: '🛠 Manutenção',
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
  autor_tipo?: 'morador' | 'staff'   // default 'morador'
  autor_id?: string                   // default = morador_user_id
  skip_bot?: boolean                  // staff-initiated nao dispara o bot
  status?: StatusConversa             // default 'aberta'
}): Promise<Conversa> {
  const autor_tipo = input.autor_tipo ?? 'morador'
  const status: StatusConversa = input.status ?? (autor_tipo === 'staff' ? 'em_atendimento' : 'aberta')
  const { data: conv, error: cErr } = await supabase
    .from('conversas')
    .insert({
      condominio_id: input.condominio_id,
      morador_user_id: input.morador_user_id,
      assunto: input.assunto,
      status,
    })
    .select('*')
    .single()
  if (cErr) throw cErr

  const conversa = conv as Conversa
  await supabase.from('mensagens').insert({
    conversa_id: conversa.id,
    autor_id: input.autor_id ?? input.morador_user_id,
    autor_tipo,
    conteudo: input.primeira_mensagem.trim(),
  })

  if (!input.skip_bot && autor_tipo === 'morador') {
    setTimeout(() => {
      supabase.functions
        .invoke('chat-bot', { body: { conversa_id: conversa.id } })
        .catch(() => {})
    }, 800)
  }

  // Se staff iniciou, manda push pro morador como em respostas
  if (autor_tipo === 'staff') {
    notifyMoradorChatPush(conversa.id, input.primeira_mensagem).catch(() => {})
  }

  return conversa
}

/**
 * Envia mensagem pra todos os proprietarios ativos de uma unidade que tenham
 * acesso ao app (user_id != null). Cria uma conversa pra cada um.
 * Retorna lista de conversas criadas e a contagem de pessoas elegiveis.
 */
export async function createConversasUnidadeProprietarios(input: {
  condominio_id: string
  unidade_id: string
  assunto: AssuntoConversa
  mensagem: string
  staff_user_id: string
}): Promise<{ criadas: Conversa[]; sem_acesso: number }> {
  const { data: pessoas, error: pErr } = await supabase
    .from('pessoas')
    .select('id, nome, user_id, relacao_unidade, ativo')
    .eq('condominio_id', input.condominio_id)
    .eq('unidade_id', input.unidade_id)
    .eq('ativo', true)
    .eq('relacao_unidade', 'proprietario')
  if (pErr) throw pErr

  const elegiveis = (pessoas ?? []).filter((p) => !!p.user_id)
  const sem_acesso = (pessoas ?? []).length - elegiveis.length
  const criadas: Conversa[] = []
  for (const p of elegiveis) {
    try {
      const c = await createConversa({
        condominio_id: input.condominio_id,
        morador_user_id: p.user_id as string,
        assunto: input.assunto,
        primeira_mensagem: input.mensagem,
        autor_tipo: 'staff',
        autor_id: input.staff_user_id,
        skip_bot: true,
      })
      criadas.push(c)
    } catch (e) {
      console.warn('[chat] falha ao criar conversa pra', p.nome, e)
    }
  }
  return { criadas, sem_acesso }
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

  // Se foi morador escrevendo, dispara o bot (fire-and-forget). Etapa 52.
  if (input.autor_tipo === 'morador') {
    triggerBot(input.conversa_id).catch((e) =>
      console.warn('[chat-bot] falha:', e.message),
    )
  }

  // Se foi staff escrevendo, dispara push pro morador (etapa 78)
  if (input.autor_tipo === 'staff') {
    notifyMoradorChatPush(input.conversa_id, input.conteudo).catch((e) =>
      console.warn('[chat] push falhou:', e.message),
    )
  }
}

async function notifyMoradorChatPush(conversa_id: string, conteudo: string): Promise<void> {
  const { data: conv } = await supabase
    .from('conversas')
    .select('morador_user_id')
    .eq('id', conversa_id)
    .maybeSingle()
  if (!conv?.morador_user_id) return
  await sendPush({
    user_ids: [conv.morador_user_id],
    titulo: '💬 Resposta da administração',
    corpo: conteudo.slice(0, 140),
    link: `/chat/${conversa_id}`,
  })
}

async function triggerBot(conversa_id: string): Promise<void> {
  // Aguarda 800ms (sensação de "digitando...")
  await new Promise((r) => setTimeout(r, 800))
  await supabase.functions.invoke('chat-bot', { body: { conversa_id } })
}

export async function deleteConversa(id: string): Promise<void> {
  // mensagens.conversa_id tem ON DELETE CASCADE, entao a thread some junto.
  const { error } = await supabase.from('conversas').delete().eq('id', id)
  if (error) throw error
}

export async function mudarStatusConversa(id: string, status: StatusConversa, atribuida_para?: string | null): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (atribuida_para !== undefined) patch.atribuida_para = atribuida_para
  const { error } = await supabase.from('conversas').update(patch).eq('id', id)
  if (error) throw error
}
