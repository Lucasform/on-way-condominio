// scripts/check-schema.mjs
// Lista as tabelas no schema public.

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
  select table_name,
         (select count(*) from information_schema.columns c
            where c.table_schema='public' and c.table_name=t.table_name) as cols
    from information_schema.tables t
   where table_schema='public' and table_type='BASE TABLE'
   order by table_name;
`)
console.table(r.rows)
await client.end()
