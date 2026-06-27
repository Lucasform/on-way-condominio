import { supabase } from './supabase'
import type { Multa, MultaInput, MultaStatusLog, StatusMulta } from '../types/multa'
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
      vencimento_em: input.vencimento_em ?? null,
      // W1 SoD: entra como pendente_aprovacao; outro gestor aprova para em_analise
      status: 'pendente_aprovacao',
      aplicada_por,
      criado_por: aplicada_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Multa
}

export async function updateMultaVencimento(id: string, vencimento_em: string | null): Promise<void> {
  const { error } = await supabase.from('multas').update({ vencimento_em }).eq('id', id)
  if (error) throw error
}

export async function listMultaStatusLog(multa_id: string): Promise<MultaStatusLog[]> {
  const { data, error } = await supabase
    .from('multa_status_log')
    .select('*')
    .eq('multa_id', multa_id)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as MultaStatusLog[]
}

/**
 * Cria uma multa a partir de uma ocorrência e atualiza a ocorrência
 * pra status `virou_multa`. Não é atômico (2 calls); se a 2ª falhar, a multa
 * fica criada e a ocorrência mantém o status antigo (detectável). Cancelar a
 * multa depois reverte a ocorrência automaticamente (ver changeMultaStatus).
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
      titulo: `💰 Multa registrada: R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}`,
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
  pendente_aprovacao: ['em_analise', 'cancelada'],
  em_analise: ['aplicada', 'cancelada', 'arquivada'],
  aplicada: ['paga', 'contestada', 'cancelada'],
  contestada: ['aplicada', 'cancelada'],
  paga: [],
  cancelada: [],
  arquivada: ['em_analise'],
}

export const MULTA_STATUS_LABEL: Record<StatusMulta, string> = {
  pendente_aprovacao: 'Aguard. aprovação',
  em_analise: 'Em análise',
  aplicada: 'Aplicada',
  paga: 'Paga',
  contestada: 'Contestada',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
}

// Exclusão definitiva — RLS já restringe a admin_onway.
export async function deleteMulta(id: string): Promise<void> {
  const { error } = await supabase.from('multas').delete().eq('id', id)
  if (error) throw error
}

export async function changeMultaStatus(id: string, newStatus: StatusMulta): Promise<void> {
  const cur = await getMulta(id)
  if (!cur) throw new Error('Multa não encontrada.')
  // Guard: rejeita transição que não está no mapa (protege chamadas fora da UI).
  if (cur.status !== newStatus && !MULTA_STATUS_TRANSITIONS[cur.status].includes(newStatus)) {
    throw new Error(`Transição inválida: ${MULTA_STATUS_LABEL[cur.status]} → ${MULTA_STATUS_LABEL[newStatus]}.`)
  }

  const patch: Record<string, unknown> = { status: newStatus }
  const today = new Date().toISOString().slice(0, 10)
  if (newStatus === 'aplicada') {
    patch.data_aplicacao = today
  }
  if (newStatus === 'paga') {
    patch.data_pagamento = today
    // não pode ser null se status='paga'
    if (!cur.data_aplicacao) patch.data_aplicacao = today
  }
  const { error } = await supabase.from('multas').update(patch).eq('id', id)
  if (error) throw error

  // Reversão: ao cancelar a multa, destrava a ocorrência de origem (virou_multa →
  // em_analise) e a notificação ligada (multa_gerada → enviada). Os filtros de
  // status deixam isso idempotente — só mexe se estiver exatamente no estado preso.
  if (newStatus === 'cancelada') {
    if (cur.ocorrencia_id) {
      await supabase
        .from('ocorrencias')
        .update({ status: 'em_analise' })
        .eq('id', cur.ocorrencia_id)
        .eq('status', 'virou_multa')
    }
    await supabase
      .from('notificacoes')
      .update({ status: 'enviada' })
      .eq('multa_id', id)
      .eq('status', 'multa_gerada')
  }
}
