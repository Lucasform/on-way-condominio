import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BASE_URL = Deno.env.get('BASE_URL') ?? 'https://onway-condominio.vercel.app'
const FROM = 'OnWay Condomínio <noreply@onwaytech.com.br>'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autorizado.' }, 401)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return jsonResponse({ error: 'Token inválido.' }, 401)

  const { data: perfil } = await admin.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin_onway') return jsonResponse({ error: 'Acesso restrito a admin_onway.' }, 403)

  try {
    const body = await req.json() as { email?: string; nome?: string }
    const email = (body.email ?? '').toLowerCase().trim()
    if (!email || !email.includes('@')) return jsonResponse({ error: 'E-mail inválido.' }, 400)

    const nome = (body.nome ?? '').trim() || null

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const codigo = Array.from({ length: 8 }, (_, i) => chars[(i * 7 + 13) % chars.length]).join('')
      .split('').map(() => chars[Math.floor(Math.random() * chars.length)]).join('')

    const expira = new Date()
    expira.setDate(expira.getDate() + 30)

    const { data: convite, error: insertErr } = await admin
      .from('convites_plataforma')
      .insert({
        codigo,
        role: 'parceiro',
        nome_destinatario: nome,
        email_destinatario: email,
        criado_por: user.id,
        usos_max: 1,
        expira_em: expira.toISOString(),
      })
      .select('*')
      .single()

    if (insertErr) return jsonResponse({ error: insertErr.message }, 500)

    const link = `${BASE_URL}/parceiro/entrar?code=${codigo}`
    const html = buildEmailHtml({ nome, codigo, link })

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: '🏢 Convite para gerenciar condomínios no OnWay',
        html,
        text: buildEmailText({ nome, codigo, link, baseUrl: BASE_URL }),
      }),
    })

    if (!resendRes.ok) {
      const resendErr = await resendRes.text()
      console.error('Resend error:', resendErr)
      return jsonResponse({ ...convite, email_enviado: false }, 201)
    }

    return jsonResponse({ ...convite, email_enviado: true }, 201)
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
}

function buildEmailHtml(args: { nome: string | null; codigo: string; link: string }): string {
  const { nome, codigo, link } = args
  const nomeHtml = nome ? `, <strong style="color:#fff;">${esc(nome)}</strong>` : ''
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Convite OnWay Condomínio</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;max-width:560px;width:100%;">

        <!-- Cabeçalho com gradiente -->
        <tr><td style="background:linear-gradient(135deg,#6d28d9 0%,#4f46e5 60%,#0ea5e9 100%);padding:40px 40px 32px;">
          <div style="font-size:36px;margin-bottom:12px;">🏢</div>
          <div style="color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">OnWay Condomínio</div>
          <div style="color:#fff;font-size:24px;font-weight:700;line-height:1.3;">Você foi convidado para gerenciar condomínios</div>
        </td></tr>

        <!-- Corpo -->
        <tr><td style="padding:36px 40px;font-size:15px;line-height:1.65;color:#94a3b8;">

          <p style="margin:0 0 20px;font-size:17px;color:#e2e8f0;">Olá${nomeHtml}! 👋</p>

          <p style="margin:0 0 20px;">Você recebeu um convite para se tornar um <strong style="color:#a78bfa;">Parceiro OnWay</strong> — uma conta especial que permite gerenciar múltiplos condomínios em uma única plataforma.</p>

          <!-- Feature cards -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
            <tr>
              <td width="31%" style="padding:14px 10px;background:#0f172a;border-radius:10px;border:1px solid #1e3a5f;text-align:center;vertical-align:top;">
                <div style="font-size:22px;margin-bottom:7px;">🏢</div>
                <div style="color:#64748b;font-size:11px;font-weight:500;">Multi-condomínio</div>
              </td>
              <td width="4%"></td>
              <td width="30%" style="padding:14px 10px;background:#0f172a;border-radius:10px;border:1px solid #1e3a5f;text-align:center;vertical-align:top;">
                <div style="font-size:22px;margin-bottom:7px;">📊</div>
                <div style="color:#64748b;font-size:11px;font-weight:500;">Dashboard unificado</div>
              </td>
              <td width="4%"></td>
              <td width="31%" style="padding:14px 10px;background:#0f172a;border-radius:10px;border:1px solid #1e3a5f;text-align:center;vertical-align:top;">
                <div style="font-size:22px;margin-bottom:7px;">🔔</div>
                <div style="color:#64748b;font-size:11px;font-weight:500;">Alertas em tempo real</div>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 28px;">Clique no botão abaixo para criar sua conta. O convite é <strong style="color:#e2e8f0;">pessoal</strong> e expira em <strong style="color:#fbbf24;">30 dias</strong>.</p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);">
              <a href="${esc(link)}" style="display:inline-block;padding:15px 40px;color:#fff;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">✨ &nbsp;Criar minha conta</a>
            </td></tr>
          </table>

          <!-- Código alternativo -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;margin:0 0 24px;">
            <tr><td style="padding:18px 22px;">
              <div style="color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Código de acesso alternativo</div>
              <div style="color:#a78bfa;font-size:24px;font-weight:700;letter-spacing:8px;font-family:'Courier New',monospace;">${esc(codigo)}</div>
              <div style="color:#475569;font-size:11px;margin-top:8px;">Use em: onway-condominio.vercel.app/parceiro/entrar</div>
            </td></tr>
          </table>

          <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">Este convite é de uso único e pessoal. Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>

        </td></tr>

        <!-- Rodapé -->
        <tr><td style="padding:18px 40px;border-top:1px solid #1e293b;background:#080d15;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#1e293b;font-size:11px;"><strong style="color:#334155;">OnWay Condomínio</strong></td>
              <td align="right" style="color:#334155;font-size:11px;">onwaytech.com.br</td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildEmailText(args: { nome: string | null; codigo: string; link: string; baseUrl: string }): string {
  const { nome, codigo, link, baseUrl } = args
  return `Olá${nome ? `, ${nome}` : ''}!

Você foi convidado para se tornar um Parceiro OnWay — uma conta especial que permite gerenciar múltiplos condomínios em uma única plataforma.

Acesse o link abaixo para criar sua conta:
${link}

Ou use o código ${codigo} em ${baseUrl}/parceiro/entrar

O convite é pessoal, de uso único, e expira em 30 dias.

Se você não esperava este e-mail, pode ignorá-lo com segurança.

OnWay Condomínio · onwaytech.com.br`
}
