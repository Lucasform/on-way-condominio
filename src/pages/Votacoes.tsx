import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listVotacoes } from '../lib/votacoes'
import { listCondominios } from '../lib/condominios'
import type { Votacao, StatusVotacao } from '../types/votacao'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const STATUS_LABEL: Record<StatusVotacao, string> = {
  aberta: 'Aberta',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusVotacao, string> = {
  aberta: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  encerrada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelada: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export default function Votacoes() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canCreate = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Votacao[]>([])
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
    listVotacoes({ condominio_id: isAdmin && scopeId ? scopeId : undefined })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [scopeId, isAdmin])

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Votações"
        subtitle="Assembleias e decisões coletivas do condomínio."
        actions={
          canCreate && (
            <Link to="/votacoes/nova">
              <Button>+ Nova votação</Button>
            </Link>
          )
        }
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma votação encontrada." />
      ) : (
        <div className="space-y-3">
          {rows.map((v) => (
            <article
              key={v.id}
              onClick={() => navigate(`/votacoes/${v.id}`)}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 cursor-pointer hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-100">{v.titulo}</h3>
                  {v.descricao && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{v.descricao}</p>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    Início: {new Date(v.data_inicio).toLocaleDateString('pt-BR')}
                    {v.data_fim && ` · Fim: ${new Date(v.data_fim).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[v.status]}`}>
                  {STATUS_LABEL[v.status]}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
