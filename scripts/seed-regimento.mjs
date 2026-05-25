// scripts/seed-regimento.mjs
// Popula 8 artigos exemplo no regimento do Condomínio Demo.
// Idempotente: usa titulo + condominio_id como chave de upsert manual.

import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`
const user = host.startsWith('db.') ? 'postgres' : `postgres.${process.env.SUPABASE_PROJECT_REF}`

const client = new pg.Client({
  host, port: 5432, user, password, database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

const ARTIGOS = [
  {
    ordem: 1,
    numero: 'Art. 1º',
    titulo: 'Horário de silêncio',
    conteudo:
      'É obrigatório o silêncio nas unidades e áreas comuns entre 22h e 8h em dias úteis, e entre 22h e 10h aos sábados, domingos e feriados. ' +
      'Sons audíveis fora da unidade (música, instrumentos, obras, eletrodomésticos ruidosos) constituem infração.',
  },
  {
    ordem: 2,
    numero: 'Art. 2º',
    titulo: 'Uso da garagem e vagas',
    conteudo:
      'É vedado estacionar em vaga alheia, em vaga de visitantes por período superior a 6 horas, ou nas áreas de circulação. ' +
      'A lavagem de veículos nas vagas é permitida apenas no horário de 8h às 18h e mediante uso racional de água.',
  },
  {
    ordem: 3,
    numero: 'Art. 3º',
    titulo: 'Animais domésticos',
    conteudo:
      'A presença de animais é permitida desde que mantidos no interior da unidade, transportados com guia e focinheira (cães de grande porte) ' +
      'nas áreas comuns, e desde que não causem incômodo aos demais condôminos. O proprietário é responsável pela limpeza imediata de dejetos.',
  },
  {
    ordem: 4,
    numero: 'Art. 4º',
    titulo: 'Descarte de lixo',
    conteudo:
      'Os resíduos domésticos devem ser acondicionados em sacos plásticos vedados e depositados exclusivamente no compartimento destinado a lixo. ' +
      'É proibido deixar sacos no corredor, na garagem ou em qualquer outra área comum. Lixo reciclável tem coleta separada às terças e sextas.',
  },
  {
    ordem: 5,
    numero: 'Art. 5º',
    titulo: 'Uso das áreas comuns',
    conteudo:
      'As áreas comuns (piscina, churrasqueira, salão de festas, academia) devem ser utilizadas conforme regimento próprio e mediante reserva ' +
      'no portal. É proibido reservar e não comparecer mais de duas vezes consecutivas. O usuário responde por danos causados ao espaço.',
  },
  {
    ordem: 6,
    numero: 'Art. 6º',
    titulo: 'Obras e reformas',
    conteudo:
      'Obras e reformas internas só podem ser realizadas em dias úteis, entre 8h e 17h, mediante prévia comunicação à administração com ' +
      'no mínimo 48 horas de antecedência. É vedado o uso de equipamentos ruidosos aos sábados após 13h, e proibido aos domingos e feriados.',
  },
  {
    ordem: 7,
    numero: 'Art. 7º',
    titulo: 'Sacadas e fachadas',
    conteudo:
      'É proibido estender roupas, colocar antenas, instalar grades, pintar ou modificar de qualquer forma a fachada externa do prédio. ' +
      'Vasos de plantas nas sacadas devem ser firmemente fixados para evitar quedas. Churrasqueira na sacada é proibida em qualquer hipótese.',
  },
  {
    ordem: 8,
    numero: 'Art. 8º',
    titulo: 'Multas e penalidades',
    conteudo:
      'O descumprimento dos artigos deste regimento sujeita o infrator a multa, cujo valor varia conforme a gravidade da infração: ' +
      'leve (R$ 100), média (R$ 300), grave (R$ 500), gravíssima (R$ 1000). Reincidência no mesmo artigo dobra o valor. ' +
      'A multa será comunicada por escrito e prazo de defesa é de 10 dias.',
  },
]

await client.connect()
console.log('[seed-regimento] conectado')

try {
  // Acha o Condomínio Demo
  const demo = await client.query(
    `select id from public.condominios where nome='Condomínio Demo' limit 1`,
  )
  if (demo.rows.length === 0) {
    throw new Error('Condomínio Demo não encontrado. Rode `node scripts/seed-demo.mjs` antes.')
  }
  const condoId = demo.rows[0].id
  console.log(`[seed-regimento] condomínio Demo: ${condoId}`)

  await client.query('begin')

  let inserted = 0
  let updated = 0
  for (const art of ARTIGOS) {
    const existing = await client.query(
      `select id from public.regimento_artigos
        where condominio_id=$1 and titulo=$2`,
      [condoId, art.titulo],
    )
    if (existing.rows.length > 0) {
      await client.query(
        `update public.regimento_artigos
            set numero=$2, conteudo=$3, ordem=$4
          where id=$1`,
        [existing.rows[0].id, art.numero, art.conteudo, art.ordem],
      )
      updated++
    } else {
      await client.query(
        `insert into public.regimento_artigos
           (condominio_id, numero, titulo, conteudo, ordem)
         values ($1, $2, $3, $4, $5)`,
        [condoId, art.numero, art.titulo, art.conteudo, art.ordem],
      )
      inserted++
    }
  }

  await client.query('commit')
  console.log(`\n[seed-regimento] ✓ ${inserted} inseridos, ${updated} atualizados (${ARTIGOS.length} total)`)
  console.log('  artigos: silêncio, garagem, animais, lixo, áreas comuns, obras, fachada, multas')
  console.log('\n  ⚠ Embeddings ainda NÃO foram gerados.')
  console.log('  Quando a Edge Function `generate-embedding` for deployed, será preciso')
  console.log('  chamar pra cada artigo (script separado virá quando estiver no ar).')
} catch (e) {
  console.error('[seed-regimento] erro:', e.message)
  await client.query('rollback')
  process.exitCode = 1
} finally {
  await client.end()
}
