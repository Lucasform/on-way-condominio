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
  email: 'ok' | 'sem_email' | 'erro'
  whatsapp: 'ok' | 'sem_whatsapp' | 'inativo' | 'erro'
  push: boolean
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
}): Promise<EnvioNotificacaoResultado> {
  const { notificacao, pessoa, condominio } = args
  const res: EnvioNotificacaoResultado = { email: 'sem_email', whatsapp: 'sem_whatsapp', push: false }

  const pdf = (await gerarPdfNotificacao({ ...args, output: 'base64' })) as { base64: string; filename: string }

  const corpoHtml =
    `<p>Olá${pessoa?.nome ? `, ${pessoa.nome}` : ''}.</p>` +
    `<p>Segue a notificação referente à sua unidade. O documento completo está em anexo.</p>` +
    `<p><strong>Assunto:</strong> ${notificacao.assunto}</p>` +
    (notificacao.artigo_regimento ? `<p><strong>Base:</strong> ${notificacao.artigo_regimento}</p>` : '') +
    `<p>${notificacao.descricao.replace(/\n/g, '<br>')}</p>`

  // E-mail (com PDF anexo)
  if (pessoa?.email) {
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
  if (pessoa?.telefone) {
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

  // Padrão (push in-app) — sempre que houver login, garante que a pessoa fique sabendo
  if (pessoa?.user_id) {
    try {
      await sendPush({
        user_ids: [pessoa.user_id],
        titulo: `📋 Nova notificação · ${condominio.nome}`,
        corpo: notificacao.assunto,
        link: `/notificacoes/${notificacao.id}`,
      })
      res.push = true
    } catch { /* ignora */ }
  }

  await changeNotificacaoStatus(notificacao.id, 'enviada').catch(() => {})
  return res
}
