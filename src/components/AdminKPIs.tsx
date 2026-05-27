import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import {
  getTempoMedioRespostaChat,
  getMultasMoMDelta,
  getOcorrenciasAbertasMais7d,
  formatDuracao,
  type ChatRespKPI,
  type MultasMoMKPI,
} from '../lib/kpis'

/**
 * KPIs gerenciais do periodo. Renderiza em qualquer pagina que tenha um
 * gestor logado. Carregamento em paralelo, falha silenciosa por card.
 */
export default function AdminKPIs() {
  const { perfil } = useAuth()
  const scope = perfil?.condominio_id ?? undefined

  const [chat, setChat] = useState<ChatRespKPI | null>(null)
  const [multas, setMultas] = useState<MultasMoMKPI | null>(null)
  const [ocorr, setOcorr] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      const [c, m, o] = await Promise.all([
        getTempoMedioRespostaChat({ condominio_id: scope, dias: 30 }).catch(() => null),
        getMultasMoMDelta({ condominio_id: scope }).catch(() => null),
        getOcorrenciasAbertasMais7d({ condominio_id: scope }).catch(() => null),
      ])
      if (cancel) return
      setChat(c)
      setMultas(m)
      setOcorr(o)
      setLoading(false)
    })()
    return () => { cancel = true }
  }, [scope])

  return (
    <section className="mt-6">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
        Indicadores do mês
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          icon="💬"
          label="Resposta média no chat"
          value={chat ? formatDuracao(chat.tempo_medio_ms) : '—'}
          detail={
            loading ? 'calculando...' :
            chat && chat.amostra > 0
              ? `${chat.amostra} resposta${chat.amostra > 1 ? 's' : ''} nos últimos 30d`
              : 'sem amostra ainda'
          }
          link="/chat"
        />
        <KpiCard
          icon="💰"
          label="Multas neste mês"
          value={multas ? String(multas.mes_atual) : '—'}
          detail={
            loading ? 'calculando...' :
            multas ? deltaLabel(multas) : ''
          }
          accent={multas ? deltaAccent(multas.delta_pct) : 'default'}
          link="/multas"
        />
        <KpiCard
          icon="⏳"
          label="Ocorrências há > 7 dias"
          value={ocorr !== null ? String(ocorr) : '—'}
          detail={
            loading ? 'calculando...' :
            ocorr === 0 ? 'tudo em dia 👍' : 'precisam de atenção'
          }
          accent={ocorr && ocorr > 0 ? 'amber' : 'default'}
          link="/ocorrencias"
        />
      </div>
    </section>
  )
}

function deltaLabel(m: MultasMoMKPI): string {
  if (m.delta_pct === null) {
    return m.mes_anterior === 0 && m.mes_atual === 0
      ? 'sem multas anteriores'
      : 'mês anterior: 0'
  }
  const sinal = m.delta_pct >= 0 ? '+' : ''
  return `${sinal}${m.delta_pct.toFixed(0)}% vs mês anterior (${m.mes_anterior})`
}

function deltaAccent(pct: number | null): 'default' | 'amber' | 'emerald' {
  if (pct === null) return 'default'
  if (pct > 20) return 'amber'      // disparou
  if (pct < -20) return 'emerald'   // caiu
  return 'default'
}

function KpiCard({
  icon, label, value, detail, link, accent = 'default',
}: {
  icon: string
  label: string
  value: string
  detail: string
  link?: string
  accent?: 'default' | 'amber' | 'emerald'
}) {
  const accentMap = {
    default: 'border-slate-800',
    amber: 'border-amber-500/40 bg-amber-500/5',
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
  }
  const Content = (
    <div className={`rounded-lg border ${accentMap[accent]} bg-slate-900/40 p-4 transition ${link ? 'hover:border-slate-600' : ''}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-100 truncate">{value}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{detail}</div>
        </div>
      </div>
    </div>
  )
  return link ? <Link to={link}>{Content}</Link> : Content
}
