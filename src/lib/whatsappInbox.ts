import { supabase } from './supabase'
import { sendWhatsApp } from './whatsapp'

export interface WaConversa {
  id: string
  condominio_id: string
  telefone: string
  contato_nome: string | null
  pessoa_id: string | null
  unidade_id: string | null
  ultima_mensagem: string | null
  ultima_mensagem_at: string | null
  nao_lidas: number
  arquivada: boolean
  created_at: string
}

export interface WaMensagem {
  id: string
  wa_conversa_id: string
  condominio_id: string
  direcao: 'in' | 'out'
  conteudo: string
  autor_id: string | null
  wa_message_id: string | null
  created_at: string
}

function normalizePhone(p: string): string {
  const d = p.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

export async function listWaConversas(
  condominio_id: string,
  opts: { arquivada?: boolean } = {},
): Promise<WaConversa[]> {
  const { data, error } = await supabase
    .from('wa_conversas')
    .select('*')
    .eq('condominio_id', condominio_id)
    .eq('arquivada', opts.arquivada ?? false)
    .order('ultima_mensagem_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as WaConversa[]
}

export async function getWaThread(wa_conversa_id: string): Promise<WaMensagem[]> {
  const { data, error } = await supabase
    .from('wa_mensagens')
    .select('*')
    .eq('wa_conversa_id', wa_conversa_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as WaMensagem[]
}

export async function markWaLida(wa_conversa_id: string): Promise<void> {
  await supabase.from('wa_conversas').update({ nao_lidas: 0 }).eq('id', wa_conversa_id)
}

export async function arquivarWaConversa(wa_conversa_id: string, arquivada = true): Promise<void> {
  await supabase.from('wa_conversas').update({ arquivada }).eq('id', wa_conversa_id)
}

export async function deleteWaConversa(wa_conversa_id: string): Promise<void> {
  const { error } = await supabase.from('wa_conversas').delete().eq('id', wa_conversa_id)
  if (error) throw error
}

/** Acha/cria a conversa do telefone e devolve. */
export async function ensureWaConversa(input: {
  condominio_id: string
  telefone: string
  contato_nome?: string | null
  pessoa_id?: string | null
  unidade_id?: string | null
}): Promise<WaConversa> {
  const telefone = normalizePhone(input.telefone)
  const { data, error } = await supabase
    .from('wa_conversas')
    .upsert({
      condominio_id: input.condominio_id,
      telefone,
      contato_nome: input.contato_nome ?? null,
      pessoa_id: input.pessoa_id ?? null,
      unidade_id: input.unidade_id ?? null,
    }, { onConflict: 'condominio_id,telefone' })
    .select('*')
    .single()
  if (error) throw error
  return data as WaConversa
}

/**
 * Envia mensagem de saída: dispara no WhatsApp e grava no histórico.
 * Retorna { ok } ou { skipped } se o canal não estiver ativo.
 */
export async function sendWaMessage(input: {
  conversa: WaConversa
  texto: string
  autor_id: string
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const r = await sendWhatsApp({
    condominio_id: input.conversa.condominio_id,
    telefone: input.conversa.telefone,
    texto: input.texto,
  })
  if (r.skipped) return { ok: false, skipped: true }
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error }

  await supabase.from('wa_mensagens').insert({
    wa_conversa_id: input.conversa.id,
    condominio_id: input.conversa.condominio_id,
    direcao: 'out',
    conteudo: input.texto,
    autor_id: input.autor_id,
  })
  await supabase
    .from('wa_conversas')
    .update({
      ultima_mensagem: input.texto.slice(0, 200),
      ultima_mensagem_at: new Date().toISOString(),
    })
    .eq('id', input.conversa.id)
  return { ok: true }
}

// ============================================================
// Seletor "nova conversa" — pessoas e unidades com telefone
// ============================================================
export interface PessoaContato {
  id: string
  nome: string
  telefone: string
  unidade_id: string | null
  unidade_label: string | null
}

export async function listContatosComTelefone(condominio_id: string): Promise<PessoaContato[]> {
  const { data, error } = await supabase
    .from('pessoas')
    .select('id, nome, telefone, unidade_id, unidades(bloco, numero)')
    .eq('condominio_id', condominio_id)
    .eq('ativo', true)
    .not('telefone', 'is', null)
    .order('nome')
  if (error) throw error
  type Row = {
    id: string; nome: string; telefone: string; unidade_id: string | null
    unidades: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null
  }
  return ((data ?? []) as unknown as Row[]).map((p) => {
    const u = Array.isArray(p.unidades) ? p.unidades[0] : p.unidades
    return {
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      unidade_id: p.unidade_id,
      unidade_label: u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : null,
    }
  })
}
