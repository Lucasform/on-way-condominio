// scripts/apply-migration.mjs
// Aplica um arquivo SQL no banco Supabase via conexão direta ao Postgres.
// Uso: node scripts/apply-migration.mjs supabase/migrations/0001_initial_schema.sql

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const file = process.argv[2]
if (!file) {
  console.error('Uso: node scripts/apply-migration.mjs <caminho.sql>')
  process.exit(1)
}

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || 'aws-1-sa-east-1.pooler.supabase.com'
const projectRef = process.env.SUPABASE_PROJECT_REF
if (!password || !projectRef) {
  console.error('Defina SUPABASE_DB_PASSWORD e SUPABASE_PROJECT_REF no ambiente.')
  process.exit(1)
}

const sql = readFileSync(resolve(file), 'utf8')

// Direct host (db.<ref>.supabase.co) uses 'postgres'.
// Pooler host (pooler.supabase.com) uses 'postgres.<ref>'.
const user = host.startsWith('db.') ? 'postgres' : `postgres.${projectRef}`

const client = new pg.Client({
  host,
  port: 5432,
  user,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

try {
  console.log(`[migration] connecting to ${host} as postgres.${projectRef}...`)
  await client.connect()
  console.log(`[migration] applying ${file} (${sql.length} bytes)...`)
  await client.query(sql)
  console.log('[migration] ✓ applied successfully')
} catch (err) {
  console.error('[migration] ✗ FAILED:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
