// scripts/cleanup-test-data.mjs
// Remove dados de teste criados por test-isolation.mjs
// (qualquer condomínio cujo nome começa com 'Condo Teste' e qualquer
//  usuário auth cujo email começa com 'teste-isolacao-')

import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
const c = await client.query(`delete from public.condominios where nome like 'Condo Teste %' returning id`)
const u = await client.query(`delete from auth.users where email like 'teste-isolacao-%@onway.local' returning id`)
console.log(`removidos: ${c.rowCount} condomínios + ${u.rowCount} usuários fake (auth)`)
await client.end()
