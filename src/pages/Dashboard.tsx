import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCondominios } from '../lib/condominios'
import { listOcorrencias } from '../lib/ocorrencias'
import { listMultas } from '../lib/multas'
import { listEncomendas } from '../lib/encomendas'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import type { Condominio } from '../types/condominio'
import type { Ocorrencia } from '../types/ocorrencia'
import type { Multa } from '../types/multa'
import type { Encomenda } from '../types/encomenda'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'
import HeatmapOcorrencias from '../components/HeatmapOcorrencias'

// Lazy: o chunk do recharts so e baixado quando o Dashboard abre de fato
const DashboardCharts = lazy(() => import('../components/DashboardCharts'))

// ----------------------------------------------------------------

export default function Dashboard() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [multas, setMultas] = useState<Multa[]>([])
  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
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
      const cid = isAdmin && scopeId ? scopeId : undefined
      const [un, pe, oc, mu, en] = await Promise.all([
        listUnidades(cid ? { condominio_id: cid, ativo: true } : { ativo: true }),
        listPessoas(cid ? { condominio_id: cid, ativo: true } : { ativo: true }),
        listOcorrencias(cid ? { condominio_id: cid } : {}),
        listMultas(cid ? { condominio_id: cid } : {}),
        listEncomendas(cid ? { condominio_id: cid } : {}),
      ])
      setUnidades(un)
      setPessoas(pe)
      setOcorrencias(oc)
      setMultas(mu)
      setEncomendas(en)
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
  }, [scopeId])

  const stats = useMemo(() => {
    const ocorrAbertas = ocorrencias.filter((o) => o.status === 'aberta' || o.status === 'em_analise').length
    const multasPendentes = multas.filter((m) =>
      m.status === 'em_analise' || m.status === 'aplicada' || m.status === 'contestada'
    ).length
    const multasPagas = multas.filter((m) => m.status === 'paga').length
    const totalMultas = multas.reduce((s, m) => s + Number(m.valor), 0)
    const arrecadado = multas.filter((m) => m.status === 'paga').reduce((s, m) => s + Number(m.valor), 0)
    const encomendasAguardando = encomendas.filter((e) => e.status === 'aguardando').length

    // Últimos 6 meses — ocorrências por mês
    const monthly: { mes: string; ocorrencias: number; multas: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' })
      monthly.push({
        mes: label,
        ocorrencias: ocorrencias.filter((o) => {
          const dt = new Date(o.created_at)
          return dt >= d && dt < next
        }).length,
        multas: multas.filter((m) => {
          const dt = new Date(m.created_at)
          return dt >= d && dt < next
        }).length,
      })
    }

    // Distribuição de status de multas
    const multasByStatus = [
      { name: 'Em análise', value: multas.filter((m) => m.status === 'em_analise').length, color: '#f59e0b' },
      { name: 'Aplicada', value: multas.filter((m) => m.status === 'aplicada').length, color: '#ef4444' },
      { name: 'Paga', value: multas.filter((m) => m.status === 'paga').length, color: '#10b981' },
      { name: 'Contestada', value: multas.filter((m) => m.status === 'contestada').length, color: '#f97316' },
      { name: 'Cancelada', value: multas.filter((m) => m.status === 'cancelada').length, color: '#64748b' },
      { name: 'Arquivada', value: multas.filter((m) => m.status === 'arquivada').length, color: '#475569' },
    ].filter((x) => x.value > 0)

    return {
      unidadesTotal: unidades.length,
      pessoasTotal: pessoas.length,
      ocorrAbertas,
      multasPendentes,
      multasPagas,
      totalMultas,
      arrecadado,
      encomendasAguardando,
      monthly,
      multasByStatus,
    }
  }, [ocorrencias, multas, encomendas, unidades, pessoas])

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do condomínio."
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-5 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400">Carregando indicadores...</div>
      ) : (
        <>
          {/* Cards de indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Unidades ativas" value={stats.unidadesTotal} link="/unidades" />
            <StatCard label="Pessoas cadastradas" value={stats.pessoasTotal} link="/pessoas" />
            <StatCard
              label="Ocorrências abertas"
              value={stats.ocorrAbertas}
              link="/ocorrencias"
              accent={stats.ocorrAbertas > 0 ? 'amber' : 'default'}
            />
            <StatCard label="Multas pendentes" value={stats.multasPendentes} link="/multas" />
            <StatCard label="Encomendas na portaria" value={stats.encomendasAguardando} link="/encomendas" />
            <StatCard label="Multas pagas" value={stats.multasPagas} link="/multas" />
            <StatCard
              label="Total em multas (R$)"
              value={stats.totalMultas.toFixed(2).replace('.', ',')}
              link="/multas"
            />
            <StatCard
              label="Arrecadado (R$)"
              value={stats.arrecadado.toFixed(2).replace('.', ',')}
              link="/multas"
            />
          </div>

          {/* Gráficos (chunk recharts lazy-loaded) */}
          <Suspense fallback={
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 h-[290px] flex items-center justify-center text-sm text-slate-500">
                Carregando gráficos...
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 h-[290px]" />
            </div>
          }>
            <DashboardCharts monthly={stats.monthly} multasByStatus={stats.multasByStatus} />
          </Suspense>

          <div className="mt-4">
            <HeatmapOcorrencias condominio_id={isAdmin && scopeId ? scopeId : (perfil?.condominio_id ?? undefined)} dias={90} />
          </div>

        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------

function StatCard({
  label,
  value,
  link,
  accent = 'default',
}: {
  label: string
  value: string | number
  link?: string
  accent?: 'default' | 'amber' | 'red' | 'sky' | 'emerald'
}) {
  const accentMap = {
    default: 'border-slate-800',
    amber: 'border-amber-500/40 bg-amber-500/5',
    red: 'border-red-500/40 bg-red-500/5',
    sky: 'border-sky-500/40 bg-sky-500/5',
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
  }
  const Content = (
    <div className={`rounded-lg border ${accentMap[accent]} bg-slate-900/40 p-4 transition ${link ? 'hover:border-slate-600' : ''}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
    </div>
  )
  return link ? <Link to={link}>{Content}</Link> : Content
}

