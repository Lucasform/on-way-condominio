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

  // ============================================================
  // 3) Refinamento pessoas (0003) — morador edita só o próprio
  // ============================================================
  console.log('\n[teste] simulando MORADOR no condo A (cobertura migration 0003)...')

  // Cria mais 1 user fake (morador) e linka como pessoa em condo A
  const moradorUserId = randomUUID()
  const moradorPessoaId = randomUUID()
  const moradorEmail = `teste-isolacao-morador-${Date.now()}@onway.local`
  await client.query('begin')
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
    [moradorUserId, moradorEmail],
  )
  await client.query(
    `insert into public.perfis (id, condominio_id, role, nome_exibicao)
     values ($1, $2, 'morador', 'Morador X')`,
    [moradorUserId, condoA_id],
  )
  await client.query(
    `insert into public.pessoas (id, condominio_id, nome, user_id)
     values ($1, $2, 'Pessoa do Morador X', $3)`,
    [moradorPessoaId, condoA_id, moradorUserId],
  )
  // Pega o id da pessoa "Morador A1" (criada no setup) — esse é DE OUTRA pessoa
  const outraPessoa = await client.query(
    `select id from public.pessoas where condominio_id=$1 and user_id is null limit 1`,
    [condoA_id],
  )
  const outraPessoaId = outraPessoa.rows[0].id
  await client.query('commit')

  // Agora simula o morador
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(moradorUserId)])

  // SELECT: morador só vê o próprio cadastro
  const pessoasMorador = await client.query('select id, nome from public.pessoas')
  assert(
    'morador vê apenas a própria pessoa (1 row)',
    pessoasMorador.rows.length === 1 && pessoasMorador.rows[0].id === moradorPessoaId,
    `${pessoasMorador.rows.length} pessoa(s): ${pessoasMorador.rows.map((r) => r.nome).join(', ')}`,
  )

  // UPDATE no próprio: deve passar
  try {
    const r = await client.query(
      `update public.pessoas set nome=$1 where id=$2 returning id`,
      ['Morador X (editado)', moradorPessoaId],
    )
    assert('morador PODE atualizar a própria pessoa', r.rowCount === 1, `${r.rowCount} row(s) afetadas`)
  } catch (e) {
    assert('morador PODE atualizar a própria pessoa', false, `bloqueou: ${e.message.split('\n')[0]}`)
  }

  // UPDATE em outra pessoa: NÃO pode (RLS deve filtrar — 0 rows afetadas)
  const updOutra = await client.query(
    `update public.pessoas set nome=$1 where id=$2 returning id`,
    ['INVASOR', outraPessoaId],
  )
  assert(
    'morador NÃO pode atualizar pessoa alheia',
    updOutra.rowCount === 0,
    `${updOutra.rowCount} row(s) afetadas (esperado 0)`,
  )

  // INSERT de nova pessoa: NÃO pode (0003 restringe)
  try {
    await client.query(
      `insert into public.pessoas (condominio_id, nome) values ($1, 'Nova Invasor')`,
      [condoA_id],
    )
    assert('morador NÃO pode inserir nova pessoa', false, 'INSERT passou (não deveria)')
  } catch (e) {
    assert(
      'morador NÃO pode inserir nova pessoa',
      e.message.includes('violates row-level security') || e.message.includes('new row violates'),
      `bloqueado: "${e.message.split('\n')[0]}"`,
    )
  }
  await client.query('rollback')

  // ============================================================
  // 4) Ocorrências (0004) — isolamento básico
  // ============================================================
  console.log('\n[teste] simulando síndico A inserindo ocorrência (cobertura 0004)...')
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userA_id)])

  // INSERT ocorrência válida
  try {
    await client.query(
      `insert into public.ocorrencias (condominio_id, descricao, reportado_por)
       values ($1, 'Lixo na garagem', $2)`,
      [condoA_id, userA_id],
    )
    assert('síndico A PODE inserir ocorrência no próprio condo', true)
  } catch (e) {
    assert('síndico A PODE inserir ocorrência no próprio condo', false, e.message.split('\n')[0])
  }

  // SELECT antes do INSERT inválido (pra não pegar transação abortada)
  const ocorrA = await client.query('select condominio_id from public.ocorrencias')
  assert(
    'síndico A só vê ocorrências do próprio condo',
    ocorrA.rows.length > 0 && ocorrA.rows.every((r) => r.condominio_id === condoA_id),
    `${ocorrA.rows.length} ocorrência(s), todas do condo A: ${ocorrA.rows.every((r) => r.condominio_id === condoA_id)}`,
  )

  // Ocorrência em condo alheio: bloqueada (usa SAVEPOINT pra não abortar a tx)
  await client.query('savepoint sp_invalid_ocorr')
  try {
    await client.query(
      `insert into public.ocorrencias (condominio_id, descricao, reportado_por)
       values ($1, 'Tentativa de invasão', $2)`,
      [condoB_id, userA_id],
    )
    assert('síndico A NÃO pode inserir ocorrência em condo B', false, 'INSERT passou')
    await client.query('release savepoint sp_invalid_ocorr')
  } catch (e) {
    await client.query('rollback to savepoint sp_invalid_ocorr')
    assert(
      'síndico A NÃO pode inserir ocorrência em condo B',
      e.message.includes('violates row-level security') || e.message.includes('new row violates'),
      `bloqueado: "${e.message.split('\n')[0]}"`,
    )
  }
  await client.query('rollback')

  // ============================================================
  // 5) Fluxo E2E Fase 2 (etapa 35): ocorrência → multa → status
  // ============================================================
  console.log('\n[teste] fluxo E2E ocorrência → multa → status (etapa 35)...')
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userA_id)])

  // Pega uma unidade do condo A pra usar na multa
  const unidA = await client.query(
    `select id from public.unidades where condominio_id=$1 limit 1`,
    [condoA_id],
  )
  const unidadeAId = unidA.rows[0].id

  // 5.1 — Cria ocorrência em 'aberta'
  const ocorrIns = await client.query(
    `insert into public.ocorrencias (condominio_id, unidade_id, descricao, reportado_por)
     values ($1, $2, 'Som alto após 22h', $3) returning id, status`,
    [condoA_id, unidadeAId, userA_id],
  )
  const ocorrId = ocorrIns.rows[0].id
  assert(
    'ocorrência criada em status "aberta"',
    ocorrIns.rows[0].status === 'aberta',
    `status=${ocorrIns.rows[0].status}`,
  )

  // 5.2 — Gera multa a partir da ocorrência
  const multaIns = await client.query(
    `insert into public.multas
       (condominio_id, unidade_id, ocorrencia_id, aplicada_por,
        valor, descricao, artigo_regimento)
     values ($1, $2, $3, $4, 150.00, 'Som alto após 22h', 'Art. 18, §2º')
     returning id, status, valor, data_aplicacao`,
    [condoA_id, unidadeAId, ocorrId, userA_id],
  )
  const multaId = multaIns.rows[0].id
  assert(
    'multa criada em status "em_analise" com data_aplicacao null',
    multaIns.rows[0].status === 'em_analise' &&
      Number(multaIns.rows[0].valor) === 150 &&
      multaIns.rows[0].data_aplicacao === null,
    `status=${multaIns.rows[0].status}, valor=${multaIns.rows[0].valor}, data_aplicacao=${multaIns.rows[0].data_aplicacao}`,
  )

  // 5.3 — Atualiza ocorrência pra "virou_multa" (o app faz isso após criar a multa)
  await client.query(
    `update public.ocorrencias set status='virou_multa' where id=$1`,
    [ocorrId],
  )
  const ocorrCheck = await client.query(`select status from public.ocorrencias where id=$1`, [ocorrId])
  assert(
    'ocorrência passou pra "virou_multa"',
    ocorrCheck.rows[0].status === 'virou_multa',
    `status=${ocorrCheck.rows[0].status}`,
  )

  // 5.4 — Aplica a multa (precisa preencher data_aplicacao pra passar no check constraint)
  await client.query(
    `update public.multas set status='aplicada', data_aplicacao=current_date where id=$1`,
    [multaId],
  )
  const multaAplicada = await client.query(
    `select status, data_aplicacao from public.multas where id=$1`,
    [multaId],
  )
  assert(
    'multa aplicada com data_aplicacao preenchida',
    multaAplicada.rows[0].status === 'aplicada' && multaAplicada.rows[0].data_aplicacao !== null,
    `status=${multaAplicada.rows[0].status}, data=${multaAplicada.rows[0].data_aplicacao}`,
  )

  // 5.5 — Tenta marcar paga SEM data_pagamento (check constraint deve barrar)
  await client.query('savepoint sp_pay_no_date')
  try {
    await client.query(
      `update public.multas set status='paga' where id=$1`,
      [multaId],
    )
    assert('check constraint barra paga sem data_pagamento', false, 'UPDATE passou (não deveria)')
    await client.query('release savepoint sp_pay_no_date')
  } catch (e) {
    await client.query('rollback to savepoint sp_pay_no_date')
    assert(
      'check constraint barra paga sem data_pagamento',
      e.message.includes('multa_paga_tem_data') || e.message.includes('check constraint'),
      `barrado: "${e.message.split('\n')[0]}"`,
    )
  }

  // 5.6 — Marca paga COM data_pagamento (deve funcionar)
  await client.query(
    `update public.multas set status='paga', data_pagamento=current_date where id=$1`,
    [multaId],
  )
  const multaPaga = await client.query(
    `select status, data_pagamento from public.multas where id=$1`,
    [multaId],
  )
  assert(
    'multa marcada como paga com data_pagamento',
    multaPaga.rows[0].status === 'paga' && multaPaga.rows[0].data_pagamento !== null,
    `status=${multaPaga.rows[0].status}, data=${multaPaga.rows[0].data_pagamento}`,
  )

  // 5.7 — Síndico A vê a multa criada
  const multasA = await client.query(`select id, status from public.multas where id=$1`, [multaId])
  assert(
    'síndico A vê a própria multa',
    multasA.rows.length === 1,
    `${multasA.rows.length} row(s)`,
  )

  await client.query('rollback')

  // 5.8 — Síndico B NÃO vê a multa do condo A (isolamento)
  // (Como rollei o anterior, a multa não persistiu. Vou criar uma persistida agora pra testar.)
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userA_id)])
  const persistMulta = await client.query(
    `insert into public.multas
       (condominio_id, unidade_id, aplicada_por, valor, descricao)
     values ($1, $2, $3, 99.00, 'multa de teste isolamento') returning id`,
    [condoA_id, unidadeAId, userA_id],
  )
  const persistMultaId = persistMulta.rows[0].id
  await client.query('commit')

  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtClaims(userB_id)])
  const seeFromB = await client.query(`select id from public.multas where id=$1`, [persistMultaId])
  assert(
    'síndico B NÃO vê multa do condo A (RLS)',
    seeFromB.rows.length === 0,
    `viu ${seeFromB.rows.length} row(s)`,
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
