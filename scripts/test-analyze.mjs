// scripts/test-analyze.mjs
// Pega uma ocorrência do Condomínio Demo e chama analyze-ocorrencia, imprime JSON.
import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const ref = process.env.SUPABASE_PROJECT_REF
const svcKey = process.env.SUPABASE_ACCESS_TOKEN

const c = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await c.connect()
const { rows } = await c.query(`
  select o.id, o.descricao, o.local
    from ocorrencias o
    join condominios cn on cn.id = o.condominio_id
   where cn.nome = 'Condomínio Demo'
   order by o.created_at desc
   limit 1
`)
await c.end()

if (rows.length === 0) {
  console.log('Nenhuma ocorrência no Condomínio Demo. Crie uma pelo app primeiro.')
  process.exit(1)
}

const ocorrencia = rows[0]
console.log(`\n[teste] Ocorrência selecionada:`)
console.log(`  id:        ${ocorrencia.id}`)
console.log(`  local:     ${ocorrencia.local ?? '(s/local)'}`)
console.log(`  descrição: ${ocorrencia.descricao}\n`)

console.log('[teste] Chamando analyze-ocorrencia... (Claude Sonnet, pode demorar ~5s)\n')

const t0 = Date.now()
const r = await fetch(`https://${ref}.supabase.co/functions/v1/analyze-ocorrencia`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Authorization: `Bearer ${svcKey}`,
    apikey: svcKey,
  },
  body: JSON.stringify({ ocorrencia_id: ocorrencia.id }),
})
const elapsed = Date.now() - t0
const data = await r.json()

console.log(`[teste] HTTP ${r.status} em ${elapsed}ms`)
console.log(JSON.stringify(data, null, 2))
