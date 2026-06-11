// scripts/backup-dados.mjs
// Backup lógico DOS DADOS (o schema já está versionado em supabase/migrations).
// Exporta cada tabela do schema public pra um JSON + um _manifest.json com
// contagens, e VALIDA que o nº de linhas gravado bate com a produção.
//
// Uso (PowerShell):
//   $env:SUPABASE_DB_PASSWORD='...'; $env:SUPABASE_PROJECT_REF='lkxnngzgmyfqgbbpmjvc';
//   $env:SUPABASE_DB_HOST='aws-1-sa-east-1.pooler.supabase.com';
//   $env:BACKUP_DIR='C:/Users/lucas/Documents/APP Condominio/onway-backup-test';
//   node scripts/backup-dados.mjs
//
// O arquivo contém dados pessoais de moradores — guarde fora do git, em local seguro.

import pg from 'pg'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = process.env.BACKUP_DIR || 'C:/Users/lucas/Documents/APP Condominio/onway-backup-test'
const { SUPABASE_DB_PASSWORD: password, SUPABASE_PROJECT_REF: ref } = process.env
const host = process.env.SUPABASE_DB_HOST || 'aws-1-sa-east-1.pooler.supabase.com'
if (!password || !ref) { console.error('Defina SUPABASE_DB_PASSWORD e SUPABASE_PROJECT_REF.'); process.exit(1) }

mkdirSync(OUT, { recursive: true })
const c = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()

const { rows: tabs } = await c.query("select tablename from pg_tables where schemaname='public' order by tablename")
const manifest = {}
let totalRows = 0, divergencias = 0
for (const { tablename } of tabs) {
  const { rows } = await c.query(`select * from public."${tablename}"`)
  writeFileSync(`${OUT}/${tablename}.json`, JSON.stringify(rows))
  const { rows: cnt } = await c.query(`select count(*)::int n from public."${tablename}"`)
  if (cnt[0].n !== rows.length) { divergencias++; console.log(`✗ ${tablename}: prod=${cnt[0].n} backup=${rows.length}`) }
  manifest[tablename] = rows.length
  totalRows += rows.length
}
writeFileSync(`${OUT}/_manifest.json`, JSON.stringify({
  geradoEm: new Date().toISOString().slice(0, 19), totalTabelas: tabs.length, totalLinhas: totalRows, tabelas: manifest,
}, null, 2))

console.log(`\nBackup em: ${OUT}`)
console.log(`Tabelas: ${tabs.length} · Linhas: ${totalRows} · Divergências: ${divergencias}`)
console.log(divergencias === 0 ? 'Íntegro ✅' : 'ATENÇÃO: divergências acima ❌')
await c.end()
process.exit(divergencias === 0 ? 0 : 1)
