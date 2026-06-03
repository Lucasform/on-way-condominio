// scripts/update-auth-templates.mjs
// Atualiza os 5 templates HTML do Supabase Auth via Management API.
// Uso:
//   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; node scripts/update-auth-templates.mjs

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF || 'lkxnngzgmyfqgbbpmjvc'
if (!TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente.')
  process.exit(1)
}

// Base shell HTML — paleta azul OnWay (#1D4ED8), Calibri/system.
function shell(titulo, corpo, ctaTexto, ctaUrl) {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;width:48px;height:48px;background:#1D4ED8;border-radius:50%;line-height:48px;color:#fff;font-weight:bold;font-size:20px">🏢</div>
    <div style="margin-top:8px;font-weight:bold;font-size:18px;color:#1D4ED8">OnWay Condomínio</div>
  </div>

  <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">${titulo}</h2>
  ${corpo}
  ${ctaUrl ? `
  <p style="text-align:center;margin:28px 0">
    <a href="${ctaUrl}" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">${ctaTexto}</a>
  </p>
  <p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie este link no navegador:<br>
    <span style="word-break:break-all;color:#1D4ED8">${ctaUrl}</span>
  </p>` : ''}

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
    Se você não solicitou este e-mail, pode ignorá-lo com segurança.<br>
    OnWay Condomínio · <a href="https://onwaytech.com.br" style="color:#1D4ED8;text-decoration:none">onwaytech.com.br</a>
  </p>
</div>`
}

const templates = {
  mailer_templates_confirmation_content: shell(
    'Confirme seu e-mail',
    '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">Olá! Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no OnWay Condomínio.</p>',
    'Confirmar e-mail',
    '{{ .ConfirmationURL }}'
  ),
  mailer_templates_email_change_content: shell(
    'Confirmar novo e-mail',
    '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">Você solicitou a alteração do seu e-mail no OnWay. Clique abaixo para confirmar o novo endereço.</p>',
    'Confirmar novo e-mail',
    '{{ .ConfirmationURL }}'
  ),
  mailer_templates_invite_content: shell(
    'Você foi convidado',
    '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">A administração do seu condomínio te convidou para usar o OnWay. Clique abaixo para criar sua senha e acessar a plataforma.</p>',
    'Aceitar convite',
    '{{ .ConfirmationURL }}'
  ),
  mailer_templates_magic_link_content: shell(
    'Acesso direto à sua conta',
    '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">Clique no botão abaixo para entrar sem precisar digitar senha. O link expira em 1 hora.</p>',
    'Entrar agora',
    '{{ .ConfirmationURL }}'
  ),
  mailer_templates_recovery_content: shell(
    'Redefinir sua senha',
    '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">Recebemos uma solicitação para redefinir a sua senha. Clique no botão abaixo para escolher uma nova.</p>',
    'Redefinir senha',
    '{{ .ConfirmationURL }}'
  ),
}

const subjects = {
  mailer_subjects_confirmation: 'Confirme seu e-mail no OnWay Condomínio',
  mailer_subjects_email_change: 'Confirme a alteração do seu e-mail',
  mailer_subjects_invite: 'Você foi convidado ao OnWay Condomínio',
  mailer_subjects_magic_link: 'Seu link de acesso ao OnWay',
  mailer_subjects_recovery: 'Redefinir senha no OnWay',
}

async function main() {
  const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`
  const body = { ...templates, ...subjects }
  console.log(`PATCH ${url} (${Object.keys(body).length} campos)...`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text()
    console.error('Falha:', r.status, txt.slice(0, 400))
    process.exit(1)
  }
  const data = await r.json()
  console.log('✓ Templates atualizados.')
  console.log('  Sender:', data.smtp_admin_email, '|', data.smtp_sender_name)
  console.log('  Subjects:')
  for (const k of Object.keys(subjects)) {
    console.log(`    ${k.replace('mailer_subjects_', '')}: ${data[k]}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
