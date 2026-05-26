// scripts/embed-regimento.mjs
// Chama a Edge Function `generate-embedding` para cada artigo do regimento
// que ainda não tem embedding (ou todos, se --all for passado).
//
// Uso:
//   SUPABASE_URL=https://...supabase.co \
//   SUPABASE_ANON_KEY=sb_publishable_... \
//   SUPABASE_DB_PASSWORD=... \
//   SUPABASE_PROJECT_REF=lkxnngzgmyfqgbbpmjvc \
//   SUPABASE_SERVICE_ROLE_KEY=...   (opcional — se não tiver, usa pg direto)
//   node scripts/embed-regimento.mjs [--all]

import pg from 'pg'

const force = process.argv.includes('--all')

const dbPassword = process.env.SUPABASE_DB_PASSWORD
const projectRef = process.env.SUPABASE_PROJECT_REF
const anonKey = process.env.SUPABASE_ANON_KEY
const supabaseUrl = process.env.SUPABASE_URL || `https://${projectRef}.supabase.co`
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!dbPassword || !projectRef) {
  console.error('Faltam SUPABASE_DB_PASSWORD e SUPABASE_PROJECT_REF.')
  process.exit(1)
}
if (!anonKey && !accessToken) {
  console.error('Forneça SUPABASE_ANON_KEY (publishable) OU SUPABASE_ACCESS_TOKEN (PAT).')
  process.exit(1)
}

// Vamos chamar a Edge Function com PAT (acesso admin), pra não depender
// de um usuário logado. Edge Function valida via Authorization header.
const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`
const apikey = anonKey || accessToken

// ============================================================
// 1) Lista os artigos do regimento que precisam de embedding
// ============================================================
const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
const q = force
  ? `select id, numero, titulo, conteudo from public.regimento_artigos
       where ativo = true order by ordem, numero`
  : `select id, numero, titulo, conteudo from public.regimento_artigos
       where ativo = true and embedding is null order by ordem, numero`

const { rows: artigos } = await client.query(q)
await client.end()

console.log(`[embed-regimento] ${artigos.length} artigos pra processar (force=${force})`)

if (artigos.length === 0) {
  console.log('[embed-regimento] nada a fazer.')
  process.exit(0)
}

// ============================================================
// 2) Chama generate-embedding pra cada um
// ============================================================
const fnUrl = `${supabaseUrl}/functions/v1/generate-embedding`
let ok = 0
let fail = 0

for (const art of artigos) {
  const label = `${art.numero ?? '(s/n)'} ${art.titulo}`.slice(0, 60)
  const text = `${art.titulo}\n${art.conteudo}`

  try {
    const r = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: authHeader,
        apikey,
      },
      body: JSON.stringify({ artigo_id: art.id, text }),
    })
    const data = await r.json().catch(() => ({}))
    if (r.ok && data.ok) {
      ok++
      console.log(`  ✓ ${label}  (dims=${data.dims})`)
    } else {
      fail++
      console.log(`  ✗ ${label}  -> ${r.status}: ${JSON.stringify(data).slice(0, 200)}`)
    }
  } catch (e) {
    fail++
    console.log(`  ✗ ${label}  -> ${(e && e.message) || e}`)
  }
}

console.log(`\n[embed-regimento] OK=${ok} FAIL=${fail}`)
process.exit(fail > 0 ? 1 : 0)
