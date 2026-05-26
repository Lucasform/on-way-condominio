import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listChamados } from '../lib/chamados'
import { listCondominios } from '../lib/condominios'
import type { Chamado, StatusChamado, PrioridadeChamado } from '../types/chamado'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const STATUS_OPTS: { value: '' | StatusChamado; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'resolvido', label: 'Resolvidos' },
  { value: 'cancelado', label: 'Cancelados' },
]

const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

const STATUS_CLASS: Record<StatusChamado, string> = {
  aberto: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_andamento: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  resolvido: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

const PRIO_CLASS: Record<PrioridadeChamado, string> = {
  baixa: 'text-slate-400',
  media: 'text-amber-300',
  alta: 'text-orange-300',
  urgente: 'text-red-300 font-bold',
}

const PRIO_LABEL: Record<PrioridadeChamado, string> = {
  baixa: 'baixa',
  media: 'média',
  alta: 'alta',
  urgente: '🚨 urgente',
}

export default function Chamados() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusChamado>('')
  const [rows, setRows] = useState<Chamado[]>([])
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
    if (isAdmin && !scopeId) return
    setLoading(true)
    listChamados({
      condominio_id: isAdmin && scopeId ? scopeId : undefined,
      status: statusFilter || undefined,
    })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [scopeId, statusFilter, isAdmin])

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        title="Chamados de manutenção"
        actions={
          <Link to="/chamados/novo">
            <Button>+ Novo chamado</Button>
          </Link>
        }
      />

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
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusChamado)}
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhum chamado encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <article
              key={c.id}
              onClick={() => navigate(`/chamados/${c.id}`)}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 cursor-pointer hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-100">{c.titulo}</span>
                    <span className={`text-xs ${PRIO_CLASS[c.prioridade]}`}>· {PRIO_LABEL[c.prioridade]}</span>
                    <span className="text-xs text-slate-500">· {c.categoria}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 line-clamp-2">{c.descricao}</p>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(c.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
