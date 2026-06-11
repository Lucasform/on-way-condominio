// scripts/smoke.mjs
// Testes de fumaça: confere que as edges críticas estão de pé e respondem o
// esperado, SEM efeito colateral (usa ids inexistentes / fila vazia).
// Uso: node scripts/smoke.mjs
// Sai com código != 0 se algo falhar (serve pra CI ou check manual pós-deploy).

const URL = process.env.SUPABASE_URL || 'https://lkxnngzgmyfqgbbpmjvc.supabase.co'
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_o52adZa2cHtX6ywPG7IThg_A17CRkmz'
const BOGUS = '00000000-0000-0000-0000-000000000000'

async function call(fn, body) {
  const r = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  return { status: r.status, data }
}

// nome, body, e função que valida a resposta (true = ok)
const casos = [
  ['monitor-saude', {}, (d) => d.ok === true],
  ['processar-envio-fila', {}, (d) => d.ok === true],
  ['analyze-ocorrencia', { ocorrencia_id: BOGUS }, (d) => typeof d.error === 'string'],
  ['chat-bot', { conversa_id: BOGUS }, (d) => typeof d.error === 'string'],
  ['votacao-publica', { action: 'info', votacao_id: BOGUS }, (d) => typeof d.error === 'string'],
]

let falhas = 0
for (const [fn, body, ok] of casos) {
  try {
    const { status, data } = await call(fn, body)
    const passou = status < 500 && ok(data)
    console.log(`${passou ? '✓' : '✗'} ${fn} → ${status} ${JSON.stringify(data).slice(0, 80)}`)
    if (!passou) falhas++
  } catch (e) {
    console.log(`✗ ${fn} → erro de rede: ${e.message}`)
    falhas++
  }
}

console.log(falhas === 0 ? '\nTudo de pé ✅' : `\n${falhas} falha(s) ❌`)
process.exit(falhas === 0 ? 0 : 1)
