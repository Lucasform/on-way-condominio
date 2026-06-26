import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listOcorrencias, getOcorrenciaFotoSignedUrl } from '../lib/ocorrencias'
import { listUnidades } from '../lib/unidades'
import { listCondominios } from '../lib/condominios'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Fab from '../components/ui/Fab'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { CardListSkeleton } from '../components/ui/Skeleton'

const STATUS_OPTS: { value: '' | StatusOcorrencia; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aberta', label: 'Abertas' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'arquivada', label: 'Arquivadas' },
  { value: 'virou_multa', label: 'Viraram multa' },
  { value: 'cancelada', label: 'Canceladas' },
]

const STATUS_LABEL: Record<StatusOcorrencia, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  arquivada: 'Arquivada',
  virou_multa: 'Virou multa',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusOcorrencia, string> = {
  aberta: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_analise: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  virou_multa: 'bg-red-500/10 text-red-300 border-red-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

export default function Ocorrencias() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusOcorrencia>('')
  const [rows, setRows] = useState<Ocorrencia[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
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

  useEffect(() => {
    listUnidades().then(setUnidades).catch(() => {})
  }, [])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listOcorrencias({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        status: statusFilter || undefined,
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
  }, [scopeId, statusFilter])

  // Gera thumbs sob demanda (signed URLs)
  useEffect(() => {
    rows.forEach(async (o) => {
      if (!o.foto_url || thumbs[o.id]) return
      const url = await getOcorrenciaFotoSignedUrl(o.foto_url, 3600)
      if (url) setThumbs((prev) => ({ ...prev, [o.id]: url }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const unidadeLabel = (uid: string | null) => {
    if (!uid) return 'Área comum'
    const u = unidades.find((x) => x.id === uid)
    if (!u) return '—'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const podeRegistrar = perfil?.role !== 'morador'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Ocorrências${rows.length > 0 ? ` (${rows.length})` : ''}`}
        subtitle="Registros de incidentes e relatos no condomínio."
        actions={
          podeRegistrar ? (
            <Link to="/ocorrencias/novo">
              <Button>+ Nova ocorrência</Button>
            </Link>
          ) : undefined
        }
      />
      {podeRegistrar && <Fab to="/ocorrencias/novo" label="Nova ocorrência" />}

      <div className="mb-5 flex flex-wrap gap-4 items-end">
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
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusOcorrencia)}
          >
            {STATUS_OPTS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <CardListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📝"
          message="Nenhuma ocorrência registrada."
          hint={statusFilter ? 'Tente mudar o filtro de status.' : undefined}
          action={podeRegistrar ? <Link to="/ocorrencias/novo"><Button size="sm">+ Registrar ocorrência</Button></Link> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <article
              key={o.id}
              onClick={() => navigate(`/ocorrencias/${o.id}`)}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex gap-4 cursor-pointer hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              {thumbs[o.id] ? (
                <img
                  src={thumbs[o.id]}
                  alt=""
                  className="w-24 h-24 rounded-md object-cover border border-slate-800 shrink-0"
                />
              ) : o.foto_url ? (
                <div className="w-24 h-24 rounded-md bg-slate-800/60 shrink-0" />
              ) : null}

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 justify-between">
                  <div className="text-xs text-slate-500">
                    {new Date(o.created_at).toLocaleString('pt-BR')} ·{' '}
                    <span className="text-slate-400">{unidadeLabel(o.unidade_id)}</span>
                    {o.local && <span className="text-slate-400"> · {o.local}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {o.ia_analysis != null && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] border border-violet-500/40 bg-violet-500/10 text-violet-200"
                        title="Análise IA disponível"
                      >
                        ✓ analisada
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-slate-200 line-clamp-3 whitespace-pre-wrap">{o.descricao}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

