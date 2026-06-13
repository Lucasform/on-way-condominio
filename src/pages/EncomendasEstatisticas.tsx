import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { getRetiradaPorUnidade, formatDuracao, type RetiradaPorUnidade } from '../lib/kpis'
import type { Condominio } from '../types/condominio'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'

const PERIODOS: { value: number; label: string }[] = [
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 180, label: 'Últimos 6 meses' },
  { value: 365, label: 'Último ano' },
]

export default function EncomendasEstatisticas() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [dias, setDias] = useState<number>(180)
  const [rows, setRows] = useState<RetiradaPorUnidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await getRetiradaPorUnidade({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        desde_dias: dias,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, dias])

  const agregado = useMemo(() => {
    if (rows.length === 0) return { total: 0, tempo_medio_global: 0, unidade_mais_rapida: '', unidade_mais_lenta: '' }
    const total = rows.reduce((s, r) => s + r.total_retiradas, 0)
    const tempoTotal = rows.reduce((s, r) => s + r.tempo_medio_ms * r.tempo_medio_ms, 0)
    // Usar ponderacao pelo total de retiradas
    const somaPonderada = rows.reduce((s, r) => s + r.tempo_medio_ms * r.total_retiradas, 0)
    const tempo_medio_global = total > 0 ? somaPonderada / total : 0
    void tempoTotal
    const fastest = [...rows].sort((a, b) => a.tempo_medio_ms - b.tempo_medio_ms)[0]
    const slowest = rows[0] // ja vem ordenado por tempo desc
    return {
      total,
      tempo_medio_global,
      unidade_mais_rapida: fastest ? unidadeNome(fastest) : '',
      unidade_mais_lenta: slowest ? unidadeNome(slowest) : '',
    }
  }, [rows])

  const columns: Column<RetiradaPorUnidade>[] = [
    {
      key: 'unidade',
      header: 'Unidade',
      render: (r) => <span className="font-medium text-slate-100">{unidadeNome(r)}</span>,
    },
    {
      key: 'total',
      header: 'Retiradas',
      render: (r) => <span className="tabular-nums">{r.total_retiradas}</span>,
    },
    {
      key: 'medio',
      header: 'Tempo médio',
      render: (r) => (
        <span className={tempoClass(r.tempo_medio_ms)}>{formatDuracao(r.tempo_medio_ms)}</span>
      ),
    },
    {
      key: 'min',
      header: 'Mais rápida',
      render: (r) => <span className="text-emerald-400 text-xs">{formatDuracao(r.tempo_min_ms)}</span>,
    },
    {
      key: 'max',
      header: 'Mais demorada',
      render: (r) => <span className="text-red-400 text-xs">{formatDuracao(r.tempo_max_ms)}</span>,
    },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Estatísticas de retirada"
        subtitle="Tempo médio entre a chegada da encomenda na portaria e a retirada pelo morador, agrupado por unidade."
        actions={
          <Link to="/encomendas">
            <Button variant="secondary">← Encomendas</Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Período</label>
          <Select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <ResumoCard label="Retiradas" value={String(agregado.total)} />
        <ResumoCard label="Tempo médio geral" value={formatDuracao(agregado.tempo_medio_global)} />
        <ResumoCard label="Unidade mais rápida" value={agregado.unidade_mais_rapida || '—'} small />
        <ResumoCard label="Unidade mais demorada" value={agregado.unidade_mais_lenta || '—'} small accent="amber" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.unidade_id}
        loading={loading}
        emptyMessage="Nenhuma retirada concluída no período."
      />

      <p className="mt-4 text-xs text-slate-500">
        Tempo de retirada = diferença entre <em>created_at</em> da encomenda e <em>entregue_em</em>. Considera apenas
        encomendas com status <strong>entregue</strong>.
      </p>
    </div>
  )
}

function unidadeNome(r: RetiradaPorUnidade): string {
  return r.bloco ? `${r.bloco}-${r.numero}` : r.numero
}

function tempoClass(ms: number): string {
  // > 48h vermelho, > 24h amarelo, resto verde
  if (ms > 48 * 3600_000) return 'text-red-400 font-medium tabular-nums'
  if (ms > 24 * 3600_000) return 'text-amber-300 font-medium tabular-nums'
  return 'text-emerald-300 font-medium tabular-nums'
}

function ResumoCard({
  label, value, small, accent = 'default',
}: {
  label: string; value: string; small?: boolean; accent?: 'default' | 'amber'
}) {
  const accentMap = {
    default: 'border-slate-800',
    amber: 'border-amber-500/40 bg-amber-500/5',
  }
  return (
    <div className={`rounded-lg border ${accentMap[accent]} bg-slate-900/40 p-4`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-bold text-slate-100 ${small ? 'text-base' : 'text-2xl'}`}>{value}</div>
    </div>
  )
}

