// scripts/test-email.mjs — testa o envio de e-mail E2E
const ref = process.env.SUPABASE_PROJECT_REF
const svcKey = process.env.SUPABASE_ACCESS_TOKEN
const to = process.argv[2] || 'lucascarvalhogonzaga@gmail.com'

console.log(`[teste] Enviando e-mail pra: ${to}`)

const r = await fetch(`https://${ref}.supabase.co/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Authorization: `Bearer ${svcKey}`,
    apikey: svcKey,
  },
  body: JSON.stringify({
    to,
    template: 'custom',
    custom: {
      subject: '🎉 OnWay Condomínio — teste de e-mail',
      html: '<p>Olá!</p><p>Este é um e-mail de teste do <strong>OnWay Condomínio</strong>.</p><p>Se você está lendo isso, a integração com Resend está funcionando perfeitamente.</p>',
      text: 'Teste de e-mail do OnWay Condomínio. Integração com Resend OK.',
    },
  }),
})

const data = await r.json()
console.log(`[teste] HTTP ${r.status}`)
console.log(JSON.stringify(data, null, 2))
