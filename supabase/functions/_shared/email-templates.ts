// supabase/functions/_shared/email-templates.ts
// Templates de e-mail em PT-BR — substituição simples {{var}}.
// Mantemos templates no código (não em tabela) pra MVP. Quando admin precisar
// customizar, migramos pra DB.

const FROM_DOMAIN = 'noreply@onwaytech.com.br'
const FROM_FALLBACK_NAME = 'OnWay Condomínio'

function buildFrom(senderName?: string | null): string {
  const safe = (senderName ?? '').trim().replace(/[<>"\\]/g, '')
  const display = safe || FROM_FALLBACK_NAME
  return `${display} <${FROM_DOMAIN}>`
}

export interface RenderedEmail {
  from: string
  subject: string
  html: string
  text: string
}

function shell(corpo: string, condominio_nome?: string, sender_name?: string | null): string {
  const headerTitle = (sender_name ?? '').trim() || condominio_nome || FROM_FALLBACK_NAME
  const headerSub = sender_name && condominio_nome ? condominio_nome : null
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
        <tr><td style="padding:24px 28px;background:linear-gradient(90deg,#10b981,#0ea5e9);color:#fff;">
          <div style="font-size:20px;font-weight:700;">${escape(headerTitle)}</div>
          ${headerSub ? `<div style="font-size:13px;opacity:.85;margin-top:4px;">${escape(headerSub)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.55;">${corpo}</td></tr>
        <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
          E-mail enviado via OnWay Condomínio. Não responda este e-mail. Para falar com a administração, entre no app.
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

// Variante que NAO escapa o conteudo — use quando intencionalmente
// houver HTML inline (ex: <strong>). Variaveis devem ser pre-escapadas.
function pRaw(html: string): string {
  return `<p style="margin:0 0 14px;">${html}</p>`
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
  /** Nome do staff que está enviando — usado no header e no FROM. */
  sender_name?: string | null
}

export type TemplateSlug =
  | 'multa-aplicada'
  | 'encomenda-chegou'
  | 'mural-nova-publicacao'
  | 'evento-lembrete'
  | 'boas-vindas'
  | 'custom'

const BR = (v?: number) =>
  typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : '—'

export function renderTemplate(slug: TemplateSlug, vars: TemplateVars, custom?: { subject: string; html: string; text?: string }): RenderedEmail {
  if (slug === 'custom') {
    if (!custom) throw new Error('Template custom requer { subject, html }')
    return {
      from: buildFrom(vars.sender_name),
      subject: custom.subject,
      html: shell(custom.html, vars.condominio_nome, vars.sender_name),
      text: custom.text ?? custom.html.replace(/<[^>]+>/g, ''),
    }
  }

  const nome = vars.morador_nome ?? 'morador(a)'

  switch (slug) {
    case 'multa-aplicada':
      return {
        from: buildFrom(vars.sender_name),
        subject: `Multa registrada — ${BR(vars.valor)}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${pRaw(`Foi registrada uma multa em seu nome${vars.artigo ? `, com base em <strong>${escape(vars.artigo)}</strong>` : ''}.`)}
${pRaw(`<strong>Valor:</strong> ${escape(BR(vars.valor))}`)}
${vars.descricao ? pRaw(`<strong>Descrição:</strong><br>${escape(vars.descricao)}`) : ''}
${p(`Você pode acessar o app pra ver detalhes, contestar ou acompanhar o status.`)}
${vars.link ? button('Ver multa no app', vars.link) : ''}
${p(`Caso tenha discordância, use a função "Contestar" no detalhe da multa.`)}`,
          vars.condominio_nome,
          vars.sender_name,
        ),
        text: `Olá, ${nome}.\nFoi registrada uma multa em seu nome${vars.artigo ? ` com base em ${vars.artigo}` : ''}.\nValor: ${BR(vars.valor)}\n${vars.descricao ? `Descrição: ${vars.descricao}\n` : ''}${vars.link ? `Ver no app: ${vars.link}\n` : ''}Para contestar, use a função no app.`,
      }

    case 'encomenda-chegou':
      return {
        from: buildFrom(vars.sender_name),
        subject: `📦 ${vars.encomenda_tipo === 'comida' ? 'Sua comida chegou' : 'Encomenda na portaria'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(vars.encomenda_tipo === 'comida'
            ? `Sua <strong>comida</strong> acabou de chegar na portaria. Retire o quanto antes.`
            : `Uma encomenda chegou pra você na portaria.`)}
${vars.descricao ? p(escape(vars.descricao)) : ''}
${vars.link ? button('Ver detalhes', vars.link) : ''}`,
          vars.condominio_nome,
          vars.sender_name,
        ),
        text: `Olá, ${nome}.\n${vars.encomenda_tipo === 'comida' ? 'Sua comida chegou na portaria.' : 'Uma encomenda chegou na portaria.'}\n${vars.descricao ?? ''}\n${vars.link ?? ''}`,
      }

    case 'mural-nova-publicacao':
      return {
        from: buildFrom(vars.sender_name),
        subject: `📣 ${vars.publicacao_titulo ?? 'Nova publicação no mural'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(`Nova publicação no mural do condomínio.`)}
${vars.publicacao_titulo ? `<h2 style="margin:0 0 10px;color:#0f172a;font-size:18px;">${escape(vars.publicacao_titulo)}</h2>` : ''}
${vars.publicacao_conteudo ? `<div style="background:#f9fafb;border-left:4px solid #10b981;padding:12px 16px;border-radius:6px;margin:14px 0;white-space:pre-wrap;">${escape(vars.publicacao_conteudo)}</div>` : ''}
${vars.link ? button('Ver no mural', vars.link) : ''}`,
          vars.condominio_nome,
          vars.sender_name,
        ),
        text: `Nova publicação no mural:\n${vars.publicacao_titulo ?? ''}\n${vars.publicacao_conteudo ?? ''}\n${vars.link ?? ''}`,
      }

    case 'evento-lembrete':
      return {
        from: buildFrom(vars.sender_name),
        subject: `📅 Lembrete: ${vars.evento_titulo ?? 'Evento'}`,
        html: shell(
          `${p(`Olá, ${escape(nome)}.`)}
${p(`Lembrete de evento no condomínio:`)}
${vars.evento_titulo ? `<h2 style="margin:0 0 10px;color:#0f172a;font-size:18px;">${escape(vars.evento_titulo)}</h2>` : ''}
${vars.evento_data ? p(`Quando: ${vars.evento_data}`) : ''}
${vars.descricao ? p(escape(vars.descricao)) : ''}
${vars.link ? button('Ver no calendário', vars.link) : ''}`,
          vars.condominio_nome,
          vars.sender_name,
        ),
        text: `Lembrete de evento:\n${vars.evento_titulo ?? ''}\n${vars.evento_data ?? ''}\n${vars.descricao ?? ''}\n${vars.link ?? ''}`,
      }

    case 'boas-vindas':
      return {
        from: buildFrom(vars.sender_name),
        subject: `Bem-vindo ao OnWay Condomínio${vars.condominio_nome ? ` — ${vars.condominio_nome}` : ''}`,
        html: shell(
          `${pRaw(`Olá, <strong>${escape(nome)}</strong>! Boas-vindas ao OnWay Condomínio.`)}
${pRaw(`Sua conta foi criada com sucesso${vars.condominio_nome ? ` no <strong>${escape(vars.condominio_nome)}</strong>` : ''}. A partir de agora você pode:`)}
<ul style="font-size:14px;color:#475569;line-height:1.7;padding-left:20px;margin:10px 0">
  <li>Acompanhar ocorrências, multas e chamados</li>
  <li>Ver encomendas e avisos do mural</li>
  <li>Conversar com a administração via chat</li>
  <li>Participar de votações e eventos</li>
</ul>
${vars.link ? button('Acessar o app', vars.link) : button('Acessar o app', 'https://on-way-condominio.vercel.app')}
${p(`Qualquer dúvida, fale com a administração do seu condomínio. Bom uso!`)}`,
          vars.condominio_nome,
          vars.sender_name,
        ),
        text: `Olá, ${nome}! Boas-vindas ao OnWay Condomínio${vars.condominio_nome ? ` (${vars.condominio_nome})` : ''}.\nSua conta foi criada com sucesso.\nAcesse: ${vars.link ?? 'https://on-way-condominio.vercel.app'}`,
      }
  }
}
