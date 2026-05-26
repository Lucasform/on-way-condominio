// supabase/functions/_shared/email-templates.ts
// Templates de e-mail em PT-BR — substituição simples {{var}}.
// Mantemos templates no código (não em tabela) pra MVP. Quando admin precisar
// customizar, migramos pra DB.

const FROM_EMAIL = 'OnWay Condomínio <noreply@onwaytech.com.br>'

export interface RenderedEmail {
  from: string
  subject: string
  html: string
  text: string
}

function shell(corpo: string, condominio_nome?: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
        <tr><td style="padding:24px 28px;background:linear-gradient(90deg,#10b981,#0ea5e9);color:#fff;">
          <div style="font-size:20px;font-weight:700;">OnWay Condomínio</div>
          ${condominio_nome ? `<div style="font-size:13px;opacity:.85;margin-top:4px;">${escape(condominio_nome)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.55;">${corpo}</td></tr>
        <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
          E-mail automático enviado por OnWay Condomínio. Para falar com a administração, responda este e-mail ou entre no app.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;">${escape(text)}</p>`
}

function button(label: string, href: string): string {
  return `<p style="margin:18px 0;"><a href="${href}" style="display:inline-block;background:#10b981;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${escape(label)}</a></p>`
}

// ============================================================
// Templates
// ============================================================

export interface TemplateVars {
  morador_nome?: string
  condominio_nome?: string
  valor?: number
  descricao?: string
  artigo?: string
  link?: string
  encomenda_tipo?: string
  publicacao_titulo?: string
  publicacao_conteudo?: string
  evento_titulo?: string
  evento_data?: string
}

export type TemplateSlug =
  | 'multa-aplicada'
  | 'encomenda-chegou'
  | 'mural-nova-publicacao'
  | 'evento-lembrete'
  | 'custom'

const BR = (v?: number) =>
  typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : '—'

export function renderTemplate(slug: TemplateSlug, vars: TemplateVars, custom?: { subject: string; html: string; text?: string }): RenderedEmail {
  if (slug === 'custom') {
    if (!custom) throw new Error('Template custom requer { subject, html }')
    return {
      from: FROM_EMAIL,
      subject: custom.subject,
      html: shell(custom.html, vars.condominio_nome),
      text: custom.text ?? custom.html.replace(/<[^>]+>/g, ''),
    }
  }

  const nome = vars.morador_nome ?? 'morador(a)'

  switch (slug) {
    case 'multa-aplicada':
      return {
        from: FROM_EMAIL,
        subject: `Multa registrada — ${BR(vars.valor)}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(`Foi registrada uma multa em seu nome${vars.artigo ? `, com base em <strong>${escape(vars.artigo)}</strong>` : ''}.`)}
${p(`<strong>Valor:</strong> ${escape(BR(vars.valor))}`)}
${vars.descricao ? p(`<strong>Descrição:</strong><br>${escape(vars.descricao)}`) : ''}
${p(`Você pode acessar o app pra ver detalhes, contestar ou acompanhar o status.`)}
${vars.link ? button('Ver multa no app', vars.link) : ''}
${p(`Caso tenha discordância, use a função "Contestar" no detalhe da multa.`)}`,
          vars.condominio_nome,
        ),
        text: `Olá, ${nome}.\nFoi registrada uma multa em seu nome${vars.artigo ? ` com base em ${vars.artigo}` : ''}.\nValor: ${BR(vars.valor)}\n${vars.descricao ? `Descrição: ${vars.descricao}\n` : ''}${vars.link ? `Ver no app: ${vars.link}\n` : ''}Para contestar, use a função no app.`,
      }

    case 'encomenda-chegou':
      return {
        from: FROM_EMAIL,
        subject: `📦 ${vars.encomenda_tipo === 'comida' ? 'Sua comida chegou' : 'Encomenda na portaria'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(vars.encomenda_tipo === 'comida'
            ? `Sua <strong>comida</strong> acabou de chegar na portaria. Retire o quanto antes.`
            : `Uma encomenda chegou pra você na portaria.`)}
${vars.descricao ? p(escape(vars.descricao)) : ''}
${vars.link ? button('Ver detalhes', vars.link) : ''}`,
          vars.condominio_nome,
        ),
        text: `Olá, ${nome}.\n${vars.encomenda_tipo === 'comida' ? 'Sua comida chegou na portaria.' : 'Uma encomenda chegou na portaria.'}\n${vars.descricao ?? ''}\n${vars.link ?? ''}`,
      }

    case 'mural-nova-publicacao':
      return {
        from: FROM_EMAIL,
        subject: `📣 ${vars.publicacao_titulo ?? 'Nova publicação no mural'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(`Nova publicação no mural do condomínio.`)}
${vars.publicacao_titulo ? `<h2 style="margin:0 0 10px;color:#0f172a;font-size:18px;">${escape(vars.publicacao_titulo)}</h2>` : ''}
${vars.publicacao_conteudo ? `<div style="background:#f9fafb;border-left:4px solid #10b981;padding:12px 16px;border-radius:6px;margin:14px 0;white-space:pre-wrap;">${escape(vars.publicacao_conteudo)}</div>` : ''}
${vars.link ? button('Ver no mural', vars.link) : ''}`,
          vars.condominio_nome,
        ),
        text: `Nova publicação no mural:\n${vars.publicacao_titulo ?? ''}\n${vars.publicacao_conteudo ?? ''}\n${vars.link ?? ''}`,
      }

    case 'evento-lembrete':
      return {
        from: FROM_EMAIL,
        subject: `📅 Lembrete: ${vars.evento_titulo ?? 'Evento'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(`Lembrete de evento no condomínio:`)}
${vars.evento_titulo ? `<h2 style="margin:0 0 10px;color:#0f172a;font-size:18px;">${escape(vars.evento_titulo)}</h2>` : ''}
${vars.evento_data ? p(`<strong>Quando:</strong> ${escape(vars.evento_data)}`) : ''}
${vars.descricao ? p(escape(vars.descricao)) : ''}
${vars.link ? button('Ver no calendário', vars.link) : ''}`,
          vars.condominio_nome,
        ),
        text: `Lembrete de evento:\n${vars.evento_titulo ?? ''}\n${vars.evento_data ?? ''}\n${vars.descricao ?? ''}\n${vars.link ?? ''}`,
      }
  }
}
