// scripts/seed-ocorrencia-teste.mjs
// Cria uma ocorrência de teste no Condomínio Demo pra exercitar a IA.
import pg from 'pg'

const c = new pg.Client({
  host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await c.connect()

const { rows: condoRows } = await c.query(
  `select id from condominios where nome='Condomínio Demo' limit 1`,
)
if (condoRows.length === 0) {
  console.error('Condomínio Demo não encontrado.')
  process.exit(1)
}
const condoId = condoRows[0].id

const { rows: unidRows } = await c.query(
  `select id from unidades where condominio_id=$1 order by numero limit 1`,
  [condoId],
)
const unidadeId = unidRows[0].id

// Pega qualquer user real pra satisfazer a FK (em produção isso vem do auth.uid())
const { rows: userRows } = await c.query(`select id from auth.users limit 1`)
if (userRows.length === 0) {
  console.error('Nenhum user em auth.users. Crie um usuário no app primeiro.')
  process.exit(1)
}
const userId = userRows[0].id

// Cria a ocorrência usando o service_role (ignora RLS).
const r = await c.query(
  `insert into ocorrencias (condominio_id, unidade_id, local, descricao, reportado_por)
   values ($1, $2, $3, $4, $5)
   returning id`,
  [
    condoId,
    unidadeId,
    'Garagem G1, vaga 14',
    'Vizinho colocou som muito alto às 23h30 da noite passada. Música funk no carro com janelas abertas. Durou mais de 1 hora e impediu o sono.',
    userId,
  ],
)
console.log(`[seed-ocorrencia] criada: ${r.rows[0].id}`)
await c.end()
