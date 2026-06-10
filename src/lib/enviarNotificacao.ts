import { supabase } from './supabase'
import { sendEmail } from './email'
import { sendWhatsApp } from './whatsapp'
import { sendPush } from './push'
import { changeNotificacaoStatus } from './notificacoes'
import { gerarPdfNotificacao } from './notificacaoPdf'
import type { Notificacao } from '../types/notificacao'
import type { Pessoa } from '../types/pessoa'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'

export interface EnvioNotificacaoResultado {
  email: 'ok' | 'sem_email' | 'nao_escolhido' | 'erro'
  whatsapp: 'ok' | 'sem_whatsapp' | 'nao_escolhido' | 'inativo' | 'erro'
  push: boolean
  app: boolean        // alerta interno (sininho) — o "padrão"
  entregue: boolean   // chegou por algum canal direto (email/whatsapp/app)
}

/** Canais diretos que o usuário pode escolher. In-app/push são sempre baseline. */
export interface CanaisEnvio {
  email: boolean
  whatsapp: boolean
}

/**
 * Envia a notificação pela unidade: e-mail (PDF anexo) + WhatsApp (PDF documento).
 * Se faltar um canal cadastrado, cai no padrão (push in-app quando há login).
 * Marca a notificação como 'enviada'. Reply-To do e-mail = e-mail do condomínio
 * (resolvido na edge a partir de condominio_id).
 */
export async function enviarNotificacaoMulticanal(args: {
  notificacao: Notificacao
  pessoa: Pessoa | null
  unidade: Unidade | null
  condominio: Condominio
  assinaturaUrl?: string | null
  emissorNome?: string | null
  /** Canais diretos escolhidos. Default: ambos. In-app/push vão sempre. */
  canais?: CanaisEnvio
}): Promise<EnvioNotificacaoResultado> {
  const { notificacao, pessoa, condominio } = args
  const escolhidos = args.canais ?? { email: true, whatsapp: true }
  // Preferência do morador (opt-out). Ausente = todos ligados (comportamento atual).
  const pref = pessoa?.canais_notificacao
  const canais = {
    email: escolhidos.email && (pref?.email ?? true),
    whatsapp: escolhidos.whatsapp && (pref?.whatsapp ?? true),
  }
  const res: EnvioNotificacaoResultado = {
    email: canais.email ? 'sem_email' : 'nao_escolhido',
    whatsapp: canais.whatsapp ? 'sem_whatsapp' : 'nao_escolhido',
    push: false, app: false, entregue: false,
  }

  const pdf = (await gerarPdfNotificacao({ ...args, output: 'base64' })) as { base64: string; filename: string }

  const corpoHtml =
    `<p>Olá${pessoa?.nome ? `, ${pessoa.nome}` : ''}.</p>` +
    `<p>Segue a notificação referente à sua unidade. O documento completo está em anexo.</p>` +
    `<p><strong>Assunto:</strong> ${notificacao.assunto}</p>` +
    (notificacao.artigo_regimento ? `<p><strong>Base:</strong> ${notificacao.artigo_regimento}</p>` : '') +
    `<p>${notificacao.descricao.replace(/\n/g, '<br>')}</p>`

  // E-mail (com PDF anexo)
  if (canais.email && pessoa?.email) {
    try {
      const r = await sendEmail({
        to: pessoa.email,
        template: 'custom',
        condominio_id: notificacao.condominio_id,
        custom: { subject: `Notificação · ${condominio.nome}`, html: corpoHtml },
        attachments: [{ filename: pdf.filename, content: pdf.base64 }],
      })
      res.email = r.ok > 0 ? 'ok' : 'erro'
    } catch {
      res.email = 'erro'
    }
  }

  // WhatsApp (PDF como documento)
  if (canais.whatsapp && pessoa?.telefone) {
    const texto =
      `*${condominio.nome}*\n\nNotificação referente à sua unidade.\n` +
      `*Assunto:* ${notificacao.assunto}\n` +
      (notificacao.artigo_regimento ? `*Base:* ${notificacao.artigo_regimento}\n` : '') +
      `\nDocumento em anexo.`
    const r = await sendWhatsApp({
      condominio_id: notificacao.condominio_id,
      telefone: pessoa.telefone,
      texto,
      documento: { base64: pdf.base64, filename: pdf.filename },
    })
    res.whatsapp = r.ok ? 'ok' : r.skipped ? 'inativo' : 'erro'
  }

  // Padrão (alerta interno) — sempre que houver login, garante o sininho no app
  // mesmo sem e-mail/telefone/push cadastrados.
  if (pessoa?.user_id) {
    try {
      await supabase.from('app_notifications').insert({
        user_id: pessoa.user_id,
        condominio_id: notificacao.condominio_id,
        tipo: 'notificacao',
        titulo: `📋 Nova notificação · ${condominio.nome}`,
        conteudo: notificacao.assunto,
        link: `/notificacoes/${notificacao.id}`,
      })
      res.app = true
    } catch (e) {
      console.warn('[notificacao] alerta in-app falhou:', e instanceof Error ? e.message : e)
    }
    // Push respeita o opt-out do morador (o sininho in-app acima é sempre gravado).
    if (pref?.push ?? true) {
      sendPush({
        user_ids: [pessoa.user_id],
        titulo: `📋 Nova notificação · ${condominio.nome}`,
        corpo: notificacao.assunto,
        link: `/notificacoes/${notificacao.id}`,
      }).then(() => { res.push = true }).catch((e) =>
        console.warn('[notificacao] push falhou:', e instanceof Error ? e.message : e),
      )
    }
  }

  res.entregue = res.email === 'ok' || res.whatsapp === 'ok' || res.app
  await changeNotificacaoStatus(notificacao.id, 'enviada').catch((e) =>
    console.warn('[notificacao] marcar enviada falhou:', e instanceof Error ? e.message : e),
  )
  return res
}
