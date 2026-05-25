// scripts/seed-demo.mjs
// Cria um "Condomínio Demo" com 3 unidades, 3 moradores fake, 2 veículos e 1 pet.
// Idempotente: se já existir, atualiza dados em vez de duplicar.

import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log('[seed] conectado')

try {
  await client.query('begin')

  // ===== Condomínio Demo =====
  const condo = await client.query(`
    insert into public.condominios
      (nome, cnpj, endereco, bairro, cidade, estado, cep, administradora, plano)
    values
      ('Condomínio Demo', '12345678000190',
       'Av. Paulista, 1000', 'Bela Vista', 'São Paulo', 'SP', '01310100',
       'Administradora Modelo Ltda.', 'free')
    on conflict do nothing
    returning id
  `)
  let condoId
  if (condo.rows.length > 0) {
    condoId = condo.rows[0].id
    console.log(`[seed] condomínio Demo criado: ${condoId}`)
  } else {
    const existing = await client.query(`select id from public.condominios where nome='Condomínio Demo' limit 1`)
    condoId = existing.rows[0].id
    console.log(`[seed] condomínio Demo já existia: ${condoId}`)
  }

  // ===== 3 unidades =====
  const unidadesData = [
    { bloco: 'A', numero: '101', tipo: 'apartamento', area: 65.5 },
    { bloco: 'A', numero: '102', tipo: 'apartamento', area: 72.0 },
    { bloco: 'B', numero: '201', tipo: 'apartamento', area: 85.0 },
  ]
  const unidadeIds = []
  for (const u of unidadesData) {
    const r = await client.query(
      `insert into public.unidades (condominio_id, bloco, numero, tipo, area_m2)
       values ($1, $2, $3, $4, $5)
       on conflict (condominio_id, coalesce(bloco,''), numero) do update set tipo = excluded.tipo
       returning id`,
      [condoId, u.bloco, u.numero, u.tipo, u.area],
    )
    unidadeIds.push(r.rows[0].id)
  }
  console.log(`[seed] ${unidadeIds.length} unidades`)

  // ===== 3 pessoas (moradores fake) =====
  const pessoasData = [
    { nome: 'Ana Souza',     cpf: '11111111111', email: 'ana@demo.local',     telefone: '11999990001', unidade_idx: 0, tipo: 'titular',  relacao: 'proprietario' },
    { nome: 'Bruno Oliveira', cpf: '22222222222', email: 'bruno@demo.local',  telefone: '11999990002', unidade_idx: 1, tipo: 'titular',  relacao: 'inquilino'    },
    { nome: 'Carla Mendes',  cpf: '33333333333', email: 'carla@demo.local',   telefone: '11999990003', unidade_idx: 2, tipo: 'titular',  relacao: 'proprietario' },
  ]
  const pessoaIds = []
  for (const p of pessoasData) {
    const r = await client.query(
      `insert into public.pessoas
         (condominio_id, unidade_id, nome, cpf, email, telefone, tipo_vinculo, relacao_unidade)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (condominio_id, cpf) where cpf is not null do update set
         nome = excluded.nome,
         email = excluded.email,
         telefone = excluded.telefone,
         unidade_id = excluded.unidade_id
       returning id`,
      [condoId, unidadeIds[p.unidade_idx], p.nome, p.cpf, p.email, p.telefone, p.tipo, p.relacao],
    )
    pessoaIds.push(r.rows[0].id)
  }
  console.log(`[seed] ${pessoaIds.length} pessoas`)

  // ===== 2 veículos =====
  const veiculosData = [
    { unidade_idx: 0, pessoa_idx: 0, placa: 'ABC1D23', modelo: 'Honda Civic 2021', cor: 'Prata',  tipo: 'carro', vaga: 'G1-15' },
    { unidade_idx: 2, pessoa_idx: 2, placa: 'XYZ4E56', modelo: 'Yamaha Fazer 250', cor: 'Preta', tipo: 'moto',  vaga: 'Moto-3' },
  ]
  for (const v of veiculosData) {
    await client.query(
      `insert into public.veiculos (condominio_id, unidade_id, pessoa_id, placa, modelo, cor, tipo, vaga)
       values ($1, $2, $3, upper($4), $5, $6, $7, $8)
       on conflict (condominio_id, upper(placa)) do update set
         modelo = excluded.modelo, cor = excluded.cor`,
      [condoId, unidadeIds[v.unidade_idx], pessoaIds[v.pessoa_idx], v.placa, v.modelo, v.cor, v.tipo, v.vaga],
    )
  }
  console.log(`[seed] ${veiculosData.length} veículos`)

  // ===== 1 pet =====
  await client.query(
    `insert into public.pets
       (condominio_id, unidade_id, pessoa_id, nome, especie, raca, porte, vacinacao_em_dia)
     values ($1, $2, $3, 'Mel', 'cao', 'Golden Retriever', 'grande', true)`,
    [condoId, unidadeIds[1], pessoaIds[1]],
  )
  console.log(`[seed] 1 pet (Mel)`)

  await client.query('commit')
  console.log('\n[seed] ✓ Condomínio Demo populado:')
  console.log(`  condomínio_id: ${condoId}`)
  console.log(`  unidades:      3 (A-101, A-102, B-201)`)
  console.log(`  pessoas:       Ana, Bruno, Carla`)
  console.log(`  veículos:      Honda Civic (Ana), Yamaha Fazer (Carla)`)
  console.log(`  pet:           Mel (Golden, Bruno)`)
} catch (e) {
  console.error('[erro]', e.message)
  await client.query('rollback')
  process.exitCode = 1
} finally {
  await client.end()
}
