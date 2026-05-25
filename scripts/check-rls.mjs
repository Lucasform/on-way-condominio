// scripts/check-rls.mjs
// Mostra RLS habilitado + count de policies por tabela.

import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const r = await client.query(`
  select c.relname as table_name,
         c.relrowsecurity as rls_on,
         c.relforcerowsecurity as rls_forced,
         (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
   order by c.relname;
`)
console.table(r.rows)

await client.end()
