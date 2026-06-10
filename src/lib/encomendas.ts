import { supabase } from './supabase'
import type { Encomenda, EncomendaInput, StatusEncomenda } from '../types/encomenda'
import { sendEmail } from './email'
import { sendPush } from './push'
import { sendWhatsApp } from './whatsapp'

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

/** Código de 4 dígitos pra confirmar retirada na portaria. */
function gerarCodigoRetirada(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
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
      codigo_retirada: gerarCodigoRetirada(),
      recebido_por,
    })
    .select('*')
    .single()
  if (error) throw error
  const encomenda = data as Encomenda

  // Avisos automaticos por tipo:
  //   - comida: chat + email + push (urgente, retirada imediata)
  //   - demais (pacote, documento, outro): so email
  if (encomenda.tipo === 'comida') {
    notifyMoradorEncomenda(encomenda, { email: true, push: true }).catch((e) =>
      console.warn('[encomenda] falha em e-mail/push:', e.message),
    )
    abrirChatEncomenda(encomenda, recebido_por).catch((e) =>
      console.warn('[encomenda] falha ao abrir chat:', e.message),
    )
  } else {
    notifyMoradorEncomenda(encomenda, { email: true, push: false }).catch((e) =>
      console.warn('[encomenda] falha em e-mail:', e.message),
    )
  }
  return encomenda
}

async function abrirChatEncomenda(encomenda: Encomenda, staff_user_id: string): Promise<void> {
  // Importacao dinamica pra evitar dependencia circular (chat -> push -> chat)
  const { createConversa } = await import('./chat')
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('user_id, nome')
    .eq('unidade_id', encomenda.unidade_id)
    .eq('ativo', true)
    .not('user_id', 'is', null)

  const moradores = (pessoas ?? []).filter((p) => !!p.user_id)
  if (moradores.length === 0) return

  // Texto padrao da mensagem, com a descricao e armazenamento (quando houver)
  const isComida = encomenda.tipo === 'comida'
  const partes: string[] = []
  if (isComida) {
    partes.push('🍔 Sua entrega de comida acabou de chegar na portaria.')
    partes.push('Por favor, desça pra retirar o quanto antes.')
  } else if (encomenda.tipo === 'documento') {
    partes.push('📄 Chegou um documento pra você na portaria.')
  } else {
    partes.push('📦 Uma encomenda chegou pra você na portaria.')
  }
  if (encomenda.descricao) partes.push(`Descrição: ${encomenda.descricao}`)
  if (encomenda.transportadora) partes.push(`Transportadora: ${encomenda.transportadora}`)
  if (encomenda.local_armazenamento) partes.push(`Local: ${encomenda.local_armazenamento}`)
  if (encomenda.codigo_retirada) partes.push(`🔑 Código de retirada: ${encomenda.codigo_retirada} (informe na portaria)`)
  const mensagem = partes.join('\n')

  for (const m of moradores) {
    try {
      await createConversa({
        condominio_id: encomenda.condominio_id,
        morador_user_id: m.user_id as string,
        assunto: 'encomenda',
        primeira_mensagem: mensagem,
        autor_tipo: 'staff',
        autor_id: staff_user_id,
        skip_bot: true,
      })
    } catch (e) {
      console.warn('[encomenda] chat falhou para', m.nome, e)
    }
  }
}

async function notifyMoradorEncomenda(
  encomenda: Encomenda,
  canais: { email: boolean; push: boolean } = { email: true, push: true },
): Promise<void> {
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('nome, email, telefone, user_id')
    .eq('unidade_id', encomenda.unidade_id)
    .eq('ativo', true)

  const moradores = pessoas ?? []
  if (moradores.length === 0) return

  const { data: condo } = await supabase
    .from('condominios')
    .select('nome')
    .eq('id', encomenda.condominio_id)
    .maybeSingle()

  if (canais.email) {
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
          codigo_retirada: encomenda.codigo_retirada ?? undefined,
          link: `${window.location.origin}/encomendas/${encomenda.id}`,
        },
      }).catch((e) => console.warn('[encomenda] email falhou:', e.message))
    }
  }

  if (canais.push) {
    const userIds = moradores.map((p) => p.user_id).filter((u): u is string => !!u)
    if (userIds.length > 0) {
      const titulo = encomenda.tipo === 'comida' ? '🍔 Sua comida chegou' : '📦 Encomenda na portaria'
      const corpoBase = encomenda.descricao ?? 'Retire na portaria.'
      sendPush({
        user_ids: userIds,
        titulo,
        corpo: encomenda.codigo_retirada ? `${corpoBase} · Código: ${encomenda.codigo_retirada}` : corpoBase,
        link: `/encomendas/${encomenda.id}`,
      }).catch((e) => console.warn('[encomenda] push falhou:', e.message))
    }
  }

  // WhatsApp (skip silencioso se o condomínio não tiver o canal ativo)
  const tituloWa = encomenda.tipo === 'comida' ? '🍔 Sua comida chegou' : '📦 Encomenda na portaria'
  for (const p of moradores) {
    if (!p.telefone) continue
    sendWhatsApp({
      condominio_id: encomenda.condominio_id,
      telefone: p.telefone,
      texto:
        `*OnWay Condomínio*\n\n${tituloWa}.\n\n` +
        (encomenda.descricao ? `${encomenda.descricao}\n\n` : '') +
        (encomenda.codigo_retirada ? `🔑 *Código de retirada:* ${encomenda.codigo_retirada}\nInforme na portaria pra retirar.\n\n` : '') +
        `Detalhes no app.`,
    }).catch((e) => console.warn('[encomenda] whatsapp falhou:', e.message))
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
