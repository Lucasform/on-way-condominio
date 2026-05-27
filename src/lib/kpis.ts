import { supabase } from './supabase'

// ============================================================
// KPIs gerenciais da home (admin/sindico/administradora)
// ============================================================

export interface ChatRespKPI {
  amostra: number          // numero de pares morador->staff considerados
  tempo_medio_ms: number   // 0 se nao houver amostra
}

/**
 * Tempo medio de primeira resposta de staff a cada mensagem de morador,
 * nos ultimos `dias` dias. Considera apenas a *primeira* resposta de staff
 * apos cada mensagem de morador (nao acumula respostas em sequencia).
 *
 * Implementacao: traz todas as mensagens do periodo num unico fetch e
 * agrega no cliente. Em condominios pequenos isso e barato; pra escala
 * maior, mover pra view materializada no banco.
 */
export async function getTempoMedioRespostaChat(opts: {
  condominio_id?: string
  dias?: number
}): Promise<ChatRespKPI> {
  const dias = opts.dias ?? 30
  const desde = new Date(Date.now() - dias * 86400_000).toISOString()

  let q = supabase
    .from('mensagens')
    .select('conversa_id, autor_tipo, created_at, conversas!inner(condominio_id)')
    .gte('created_at', desde)
    .in('autor_tipo', ['morador', 'staff'])
    .order('created_at')
  if (opts.condominio_id) {
    q = q.eq('conversas.condominio_id', opts.condominio_id)
  }
  const { data, error } = await q
  if (error) throw error

  type Row = { conversa_id: string; autor_tipo: 'morador' | 'staff'; created_at: string }
  const rows = (data ?? []) as unknown as Row[]

  // Agrupar por conversa, manter ordem cronologica
  const porConversa = new Map<string, Row[]>()
  for (const r of rows) {
    const arr = porConversa.get(r.conversa_id) ?? []
    arr.push(r)
    porConversa.set(r.conversa_id, arr)
  }

  let somaMs = 0
  let amostra = 0
  for (const msgs of porConversa.values()) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].autor_tipo !== 'morador') continue
      // procura a primeira staff apos esse indice
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].autor_tipo === 'staff') {
          const dt = new Date(msgs[j].created_at).getTime() - new Date(msgs[i].created_at).getTime()
          if (dt >= 0) {
            somaMs += dt
            amostra += 1
          }
          break
        }
        if (msgs[j].autor_tipo === 'morador') {
          // morador escreveu de novo antes de qualquer staff -> nao conta esse i
          // mas o proximo morador (j) vai virar o "i" na proxima iteracao do outer
          break
        }
      }
    }
  }
  return { amostra, tempo_medio_ms: amostra > 0 ? somaMs / amostra : 0 }
}

export function formatDuracao(ms: number): string {
  if (ms <= 0) return '—'
  const seg = Math.round(ms / 1000)
  if (seg < 60) return `${seg}s`
  const min = Math.round(seg / 60)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m > 0 ? `${h}h ${m}min` : `${h}h`
  const d = Math.floor(h / 24)
  const hr = h % 24
  return hr > 0 ? `${d}d ${hr}h` : `${d}d`
}

// ============================================================
// Multas: mes atual vs mes anterior
// ============================================================

export interface MultasMoMKPI {
  mes_atual: number
  mes_anterior: number
  delta_pct: number | null  // null se mes anterior == 0
}

export async function getMultasMoMDelta(opts: { condominio_id?: string }): Promise<MultasMoMKPI> {
  const now = new Date()
  const iniMesAtual = new Date(now.getFullYear(), now.getMonth(), 1)
  const iniMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const fimMesAnterior = iniMesAtual

  async function countNoIntervalo(de: Date, ate: Date): Promise<number> {
    let q = supabase
      .from('multas')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', de.toISOString())
      .lt('created_at', ate.toISOString())
    if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  const [mes_atual, mes_anterior] = await Promise.all([
    countNoIntervalo(iniMesAtual, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    countNoIntervalo(iniMesAnterior, fimMesAnterior),
  ])
  const delta_pct = mes_anterior === 0
    ? null
    : ((mes_atual - mes_anterior) / mes_anterior) * 100
  return { mes_atual, mes_anterior, delta_pct }
}

// ============================================================
// Ocorrencias abertas ha > 7 dias
// ============================================================

export async function getOcorrenciasAbertasMais7d(opts: { condominio_id?: string }): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString()
  let q = supabase
    .from('ocorrencias')
    .select('id', { count: 'exact', head: true })
    .in('status', ['aberta', 'em_analise'])
    .lt('created_at', cutoff)
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

// ============================================================
// Encomendas: tempo medio de retirada por unidade
// ============================================================

export interface RetiradaPorUnidade {
  unidade_id: string
  bloco: string | null
  numero: string
  total_retiradas: number
  tempo_medio_ms: number
  tempo_max_ms: number
  tempo_min_ms: number
}

export async function getRetiradaPorUnidade(opts: {
  condominio_id?: string
  desde_dias?: number     // default 180
}): Promise<RetiradaPorUnidade[]> {
  const dias = opts.desde_dias ?? 180
  const desde = new Date(Date.now() - dias * 86400_000).toISOString()

  let q = supabase
    .from('encomendas')
    .select('unidade_id, created_at, entregue_em, status, unidades!inner(bloco, numero, condominio_id)')
    .eq('status', 'entregue')
    .gte('created_at', desde)
    .not('entregue_em', 'is', null)
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { data, error } = await q
  if (error) throw error

  type Row = {
    unidade_id: string
    created_at: string
    entregue_em: string
    unidades: { bloco: string | null; numero: string; condominio_id: string }
  }
  const rows = (data ?? []) as unknown as Row[]

  const acc = new Map<string, RetiradaPorUnidade>()
  for (const r of rows) {
    const dt = new Date(r.entregue_em).getTime() - new Date(r.created_at).getTime()
    if (dt < 0) continue
    const cur = acc.get(r.unidade_id) ?? {
      unidade_id: r.unidade_id,
      bloco: r.unidades.bloco,
      numero: r.unidades.numero,
      total_retiradas: 0,
      tempo_medio_ms: 0,
      tempo_max_ms: 0,
      tempo_min_ms: Number.POSITIVE_INFINITY,
    }
    cur.total_retiradas += 1
    cur.tempo_medio_ms += dt   // acumula soma; divide depois
    if (dt > cur.tempo_max_ms) cur.tempo_max_ms = dt
    if (dt < cur.tempo_min_ms) cur.tempo_min_ms = dt
    acc.set(r.unidade_id, cur)
  }

  const out: RetiradaPorUnidade[] = []
  for (const r of acc.values()) {
    r.tempo_medio_ms = r.tempo_medio_ms / r.total_retiradas
    if (!Number.isFinite(r.tempo_min_ms)) r.tempo_min_ms = 0
    out.push(r)
  }
  // Mais lentos primeiro (sinal vermelho pra portaria)
  out.sort((a, b) => b.tempo_medio_ms - a.tempo_medio_ms)
  return out
}

// ============================================================
// Heatmap: ocorrencias por bloco x semana, ultimos 90 dias
// ============================================================

export interface HeatmapBucket {
  bloco: string
  semana: string   // 'YYYY-MM-DD' (segunda da semana)
  count: number
}

export interface HeatmapData {
  blocos: string[]
  semanas: string[]   // ordenadas
  matrix: Record<string, Record<string, number>>   // matrix[bloco][semana] = count
  max: number
  total: number
}

export async function getHeatmapOcorrencias(opts: {
  condominio_id?: string
  dias?: number   // default 90
}): Promise<HeatmapData> {
  const dias = opts.dias ?? 90
  const desde = new Date(Date.now() - dias * 86400_000)
  desde.setHours(0, 0, 0, 0)

  let q = supabase
    .from('ocorrencias')
    .select('created_at, unidade_id, unidades(bloco)')
    .gte('created_at', desde.toISOString())
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { data, error } = await q
  if (error) throw error

  type Row = { created_at: string; unidades: { bloco: string | null } | null }
  const rows = (data ?? []) as unknown as Row[]

  // Lista de semanas (segunda-feira) cobertas pelo periodo, mais antigas primeiro
  const semanas: string[] = []
  const cursor = startOfWeek(desde)
  const hoje = startOfWeek(new Date())
  while (cursor.getTime() <= hoje.getTime()) {
    semanas.push(toISODate(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  const matrix: Record<string, Record<string, number>> = {}
  const blocosSet = new Set<string>()
  let max = 0
  let total = 0

  for (const r of rows) {
    const bloco = r.unidades?.bloco?.trim() || 'Sem bloco'
    const semana = toISODate(startOfWeek(new Date(r.created_at)))
    blocosSet.add(bloco)
    if (!matrix[bloco]) matrix[bloco] = {}
    matrix[bloco][semana] = (matrix[bloco][semana] ?? 0) + 1
    if (matrix[bloco][semana] > max) max = matrix[bloco][semana]
    total += 1
  }

  const blocos = Array.from(blocosSet).sort((a, b) => {
    if (a === 'Sem bloco') return 1
    if (b === 'Sem bloco') return -1
    return a.localeCompare(b, 'pt-BR', { numeric: true })
  })

  return { blocos, semanas, matrix, max, total }
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const dow = r.getDay()                 // 0=dom, 1=seg, ...
  const diffSeg = (dow + 6) % 7          // segunda como base
  r.setDate(r.getDate() - diffSeg)
  return r
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatSemanaLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
