// scripts/test-isolation.mjs
// Etapa 27 (parcial) — testa isolamento RLS criando 2 condomínios fictícios
// e simulando 2 usuários autenticados via request.jwt.claims.
//
// Não precisa de usuários reais logando: usa a infra de JWT do Postgres
// que a Supabase usa por baixo dos panos.
//
// Os dados criados ficam no banco pra você inspecionar (Table Editor).
// Pra limpar: node scripts/cleanup-test-data.mjs

import pg from 'pg'
import { randomUUID } from 'node:crypto'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

if (!password) {
  console.error('Defina SUPABASE_DB_PASSWORD no ambiente.')
  process.exit(1)
}

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

// IDs fixos para os 2 cenários de teste
const userA_id = randomUUID()
const userB_id = randomUUID()
const condoA_id = randomUUID()
const condoB_id = randomUUID()

const userA_email = `teste-isolacao-a-${Date.now()}@onway.local`
const userB_email = `teste-isolacao-b-${Date.now()}@onway.local`

function jwtClaims(uid) {
  return JSON.stringify({ sub: uid, role: 'authenticated' })
}

const checks = []
function assert(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

await client.connect()

try {
  // ============================================================
  // 1) SETUP: criar 2 users fake + 2 condomínios + unidades + pessoas
  // ============================================================
  console.log('\n[setup] criando usuários fictícios e dados...')
  await client.query('begin')

  // Insere em auth.users (mínimo necessário)
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
       ($3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $4, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
    [userA_id, userA_email, userB_id, userB_email],
  )

  // Insere 2 condomínios
  await client.query(
    `insert into public.condominios (id, nome, cidade, estado)
     values ($1, 'Condo Teste A', 'São Paulo', 'SP'),
            ($2, 'Condo Teste B', 'Rio de Janeiro', 'RJ')`,
    [condoA_id, condoB_id],
  )

  // Insere 2 perfis (síndicos)
  await client.query(
    `insert into public.perfis (id, condominio_id, role, nome_exibicao)
     values ($1, $2, 'sindico', 'Síndico A'),
            ($3, $4, 'sindico', 'Síndico B')`,
    [userA_id, condoA_id, userB_id, condoB_id],
  )

  // Insere 2 unidades em cada condomínio
  await client.query(
    `insert into public.unidades (condominio_id, bloco, numero) values
       ($1, 'A', '101'), ($1, 'A', '102'),
       ($2, 'T1', '201'), ($2, 'T1', '202')`,
    [condoA_id, condoB_id],
  )

  // Insere 1 pessoa em cada condomínio
  await client.query(
    `insert into public.pessoas (condominio_id, nome, email)
     values ($1, 'Morador A1', 'morador-a1@teste'),
            ($2, 'Morador B1', 'morador-b1@teste')`,
    [condoA_id, condoB_id],
  )

  await client.query('commit')
  console.log('[setup] OK')

  // ============================================================
  // 2) TESTES: simular cada usuário e validar isolamento
  // ============================================================
  console.log('\n[teste] simulando síndico A (deve ver apenas condo A)...')
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userA_id)])

  const condosA = await client.query('select id, nome from public.condominios')
  assert(
    'síndico A vê apenas 1 condomínio',
    condosA.rows.length === 1 && condosA.rows[0].id === condoA_id,
    `viu ${condosA.rows.length}: ${condosA.rows.map((r) => r.nome).join(', ')}`,
  )

  const unidadesA = await client.query('select condominio_id from public.unidades')
  assert(
    'síndico A vê apenas unidades do condo A',
    unidadesA.rows.length === 2 && unidadesA.rows.every((r) => r.condominio_id === condoA_id),
    `${unidadesA.rows.length} unidades, todas do condo A: ${unidadesA.rows.every((r) => r.condominio_id === condoA_id)}`,
  )

  const pessoasA = await client.query('select condominio_id from public.pessoas')
  assert(
    'síndico A vê apenas pessoas do condo A',
    pessoasA.rows.length === 1 && pessoasA.rows[0].condominio_id === condoA_id,
    `${pessoasA.rows.length} pessoa(s)`,
  )

  // Tentativa de inserir unidade no condo B usando perfil do A
  try {
    await client.query(
      `insert into public.unidades (condominio_id, numero) values ($1, 'INVASOR')`,
      [condoB_id],
    )
    assert('síndico A NÃO pode inserir no condo B', false, 'INSERT passou (não deveria!)')
  } catch (e) {
    assert(
      'síndico A NÃO pode inserir no condo B',
      e.message.includes('violates row-level security') || e.message.includes('new row violates'),
      `bloqueado por RLS: "${e.message.split('\n')[0]}"`,
    )
  }
  await client.query('rollback')

  console.log('\n[teste] simulando síndico B (deve ver apenas condo B)...')
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userB_id)])

  const condosB = await client.query('select id, nome from public.condominios')
  assert(
    'síndico B vê apenas 1 condomínio',
    condosB.rows.length === 1 && condosB.rows[0].id === condoB_id,
    `viu ${condosB.rows.length}: ${condosB.rows.map((r) => r.nome).join(', ')}`,
  )

  const pessoasB = await client.query('select condominio_id, nome from public.pessoas')
  assert(
    'síndico B vê apenas pessoas do condo B',
    pessoasB.rows.length === 1 && pessoasB.rows[0].condominio_id === condoB_id,
    `vê: ${pessoasB.rows.map((r) => r.nome).join(', ')}`,
  )
  await client.query('rollback')

  console.log('\n[teste] simulando usuário anônimo (não autenticado)...')
  await client.query('begin')
  await client.query(`set local role anon`)
  const condosAnon = await client.query('select id from public.condominios')
  assert(
    'anônimo NÃO vê nenhum condomínio',
    condosAnon.rows.length === 0,
    `viu ${condosAnon.rows.length}`,
  )
  await client.query('rollback')
} catch (e) {
  console.error('\n[erro fatal]', e.message)
  try { await client.query('rollback') } catch {}
  process.exitCode = 1
} finally {
  console.log('\n[resumo]')
  const failed = checks.filter((c) => !c.ok)
  console.log(`  total: ${checks.length} | passou: ${checks.length - failed.length} | falhou: ${failed.length}`)
  if (failed.length) {
    console.log('\n  ✗ FALHAS:')
    for (const f of failed) console.log(`    - ${f.name}: ${f.detail}`)
    process.exitCode = 1
  } else {
    console.log('  ✓ isolamento RLS validado em todas as tabelas testadas')
  }
  console.log(`\n[info] dados de teste deixados no banco para inspeção:`)
  console.log(`  - condomínios: ${condoA_id.slice(0, 8)}..., ${condoB_id.slice(0, 8)}...`)
  console.log(`  - usuários fake (auth): ${userA_email}, ${userB_email}`)
  console.log(`  para limpar: node scripts/cleanup-test-data.mjs`)
  await client.end()
}
