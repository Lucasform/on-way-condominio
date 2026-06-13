// Limpa TODOS os dados de produção para início do MVP real.
// Mantém apenas a conta admin lucascarvalhogonzaga@gmail.com.
// IRREVERSÍVEL — rodar somente com autorização explícita.

import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log('Conectado. Iniciando limpeza...')

// 1. Encontra o user_id do admin para preservar
const { rows: [admin] } = await client.query(
  `SELECT id FROM auth.users WHERE lower(email) = 'lucascarvalhogonzaga@gmail.com'`
)
if (!admin) {
  console.error('Admin não encontrado! Abortando.')
  await client.end()
  process.exit(1)
}
console.log('Admin encontrado:', admin.id)

// 2. Apaga todos os condomínios (cascata limpa unidades, pessoas, perfis vinculados, etc.)
const condos = await client.query(`DELETE FROM public.condominios RETURNING id`)
console.log(`${condos.rowCount} condomínio(s) removido(s)`)

// 3. Apaga perfis de outros usuários (perfis.id = auth.users.id)
const perfis = await client.query(
  `DELETE FROM public.perfis WHERE id != $1 RETURNING id`,
  [admin.id]
)
console.log(`${perfis.rowCount} perfil(is) removido(s)`)

// 4. Apaga outros usuários auth
const users = await client.query(
  `DELETE FROM auth.users WHERE id != $1 RETURNING email`,
  [admin.id]
)
console.log(`${users.rowCount} usuário(s) auth removido(s):`)
for (const u of users.rows) console.log(' -', u.email)

// 5. Limpa fila de envios, notificações, rate limits e logs
const tabelas = ['envio_fila', 'app_notifications', 'ia_rate_limit', 'rate_limits', 'audit_log', 'emails']
for (const t of tabelas) {
  try {
    await client.query(`DELETE FROM public.${t}`)
    console.log(`${t} limpa`)
  } catch { console.log(`${t} — ignorada (não existe)`) }
}
console.log('Limpeza de logs/filas concluída.')

await client.end()
console.log('\n✅ Limpeza concluída. Pronto para o MVP real.')
