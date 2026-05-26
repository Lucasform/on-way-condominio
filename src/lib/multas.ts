import { supabase } from './supabase'
import type { Multa, MultaInput, StatusMulta } from '../types/multa'
import { sendEmail } from './email'
import { sendPush } from './push'
import { sendWhatsApp } from './whatsapp'

export async function listMultas(opts: {
  condominio_id?: string
  unidade_id?: string
  pessoa_id?: string
  status?: StatusMulta
} = {}): Promise<Multa[]> {
  let q = supabase.from('multas').select('*').order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.unidade_id) q = q.eq('unidade_id', opts.unidade_id)
  if (opts.pessoa_id) q = q.eq('pessoa_id', opts.pessoa_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Multa[]
}

export async function getMulta(id: string): Promise<Multa | null> {
  const { data, error } = await supabase
    .from('multas')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Multa | null
}

export async function getMultaByOcorrencia(ocorrenciaId: string): Promise<Multa | null> {
  const { data, error } = await supabase
    .from('multas')
    .select('*')
    .eq('ocorrencia_id', ocorrenciaId)
    .maybeSingle()
  if (error) throw error
  return data as Multa | null
}

export async function createMulta(input: MultaInput, aplicada_por: string): Promise<Multa> {
  const { data, error } = await supabase
    .from('multas')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id,
      pessoa_id: input.pessoa_id || null,
      ocorrencia_id: input.ocorrencia_id || null,
      valor: input.valor,
      artigo_regimento: input.artigo_regimento?.trim() || null,
      descricao: input.descricao.trim(),
      observacoes: input.observacoes?.trim() || null,
      status: 'em_analise',
      aplicada_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Multa
}

/**
 * Cria uma multa a partir de uma ocorrência e atualiza a ocorrência
 * pra status `virou_multa`. Não é atômico (2 calls), mas em caso de
 * falha na 2ª chamada a multa fica criada (e a ocorrência mantém o
 * status antigo — fácil de detectar e corrigir manualmente).
 */
export async function createMultaFromOcorrencia(
  input: MultaInput,
  aplicada_por: string,
): Promise<Multa> {
  if (!input.ocorrencia_id) {
    throw new Error('ocorrencia_id é obrigatório nesta operação.')
  }
  const multa = await createMulta(input, aplicada_por)
  const { error: upErr } = await supabase
    .from('ocorrencias')
    .update({ status: 'virou_multa' })
    .eq('id', input.ocorrencia_id)
  if (upErr) {
    console.warn(
      `[multa] criada (${multa.id}) mas falhou ao atualizar ocorrência ${input.ocorrencia_id}: ${upErr.message}`,
    )
  }
  // Dispara e-mail pro morador (fire-and-forget)
  notifyMoradorByEmail(multa).catch((e) =>
    console.warn('[multa] falha ao enviar e-mail:', e.message),
  )
  return multa
}

async function notifyMoradorByEmail(multa: Multa): Promise<void> {
  if (!multa.pessoa_id) return
  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('nome, email, telefone, user_id')
    .eq('id', multa.pessoa_id)
    .maybeSingle()
  if (!pessoa) return

  const { data: condo } = await supabase
    .from('condominios')
    .select('nome')
    .eq('id', multa.condominio_id)
    .maybeSingle()

  const link = `${window.location.origin}/multas/${multa.id}`

  // E-mail (se tem)
  if (pessoa.email) {
    await sendEmail({
      to: pessoa.email,
      template: 'multa-aplicada',
      condominio_id: multa.condominio_id,
      vars: {
        morador_nome: pessoa.nome ?? undefined,
        condominio_nome: condo?.nome ?? undefined,
        valor: Number(multa.valor),
        descricao: multa.descricao,
        artigo: multa.artigo_regimento ?? undefined,
        link,
      },
    }).catch((e) => console.warn('[multa] email falhou:', e.message))
  }

  // Push (se user logado tem subscription)
  if (pessoa.user_id) {
    sendPush({
      user_ids: [pessoa.user_id],
      titulo: `💰 Multa registrada — R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}`,
      corpo: multa.descricao.slice(0, 120),
      link: `/multas/${multa.id}`,
    }).catch((e) => console.warn('[multa] push falhou:', e.message))
  }

  // WhatsApp (skip silencioso se condo não configurou)
  if (pessoa.telefone) {
    sendWhatsApp({
      condominio_id: multa.condominio_id,
      telefone: pessoa.telefone,
      texto:
        `💰 *OnWay Condomínio*\n\n` +
        `Foi registrada uma multa em seu nome.\n\n` +
        `*Valor:* R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}\n` +
        (multa.artigo_regimento ? `*Artigo:* ${multa.artigo_regimento}\n` : '') +
        `\n${multa.descricao}\n\n` +
        `Detalhes e contestação no app.`,
    }).catch((e) => console.warn('[multa] whatsapp falhou:', e.message))
  }
}

// ============================================================
// Máquina de status
// ============================================================
// Transições permitidas a partir de cada status. Os check constraints
// da tabela (multa_paga_tem_data, multa_aplicada_tem_data) garantem
// que os updates preencham as datas corretas — fazemos isso aqui.

export const MULTA_STATUS_TRANSITIONS: Record<StatusMulta, StatusMulta[]> = {
  em_analise: ['aplicada', 'cancelada', 'arquivada'],
  aplicada: ['paga', 'contestada', 'cancelada'],
  contestada: ['aplicada', 'cancelada'],
  paga: [], // terminal
  cancelada: [], // terminal
  arquivada: ['em_analise'],
}

export const MULTA_STATUS_LABEL: Record<StatusMulta, string> = {
  em_analise: 'Em análise',
  aplicada: 'Aplicada',
  paga: 'Paga',
  contestada: 'Contestada',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
}

export async function changeMultaStatus(id: string, newStatus: StatusMulta): Promise<void> {
  const patch: Record<string, unknown> = { status: newStatus }
  const today = new Date().toISOString().slice(0, 10)
  if (newStatus === 'aplicada') {
    patch.data_aplicacao = today
  }
  if (newStatus === 'paga') {
    patch.data_pagamento = today
    // se ainda não tiver data_aplicacao, preenche também (não pode ser null se status='paga')
    const cur = await getMulta(id)
    if (cur && !cur.data_aplicacao) patch.data_aplicacao = today
  }
  const { error } = await supabase.from('multas').update(patch).eq('id', id)
  if (error) throw error
}
