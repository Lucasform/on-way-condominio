import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAssembleias } from '../lib/assembleias'
import { listCondominios } from '../lib/condominios'
import type { Assembleia, StatusAssembleia, TipoAssembleia } from '../types/assembleia'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isStaff } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const STATUS_LABEL: Record<StatusAssembleia, string> = {
  planejada: 'Planejada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusAssembleia, string> = {
  planejada: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  realizada: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const TIPO_LABEL: Record<TipoAssembleia, string> = {
  ordinaria: 'AGO',
  extraordinaria: 'AGE',
}

export default function Assembleias() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Assembleia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = isStaff(perfil?.role)

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
    setError(null)
    listAssembleias({ condominio_id: isAdmin && scopeId ? scopeId : undefined })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [scopeId, isAdmin])

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <PageHeader
        title="Assembleias"
        subtitle="Histórico de assembleias, atas e votações deliberadas."
        actions={
          canCreate && (
            <Link to="/assembleias/nova">
              <Button>+ Nova assembleia</Button>
            </Link>
          )
        }
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-4 max-w-xs">
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
        <EmptyState
          message="Nenhuma assembleia registrada."
          action={
            canCreate ? (
              <Link to="/assembleias/nova" className="text-brand-400 hover:underline text-sm">
                Registrar a primeira →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Link
              key={a.id}
              to={`/assembleias/${a.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono uppercase tracking-wide text-slate-500">
                      {TIPO_LABEL[a.tipo]}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    {a.ata_url && (
                      <span className="text-xs text-emerald-400">📄 ata anexada</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 truncate">{a.titulo}</h3>
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(a.data_assembleia).toLocaleString('pt-BR')}
                    {a.local ? ` · ${a.local}` : ''}
                  </div>
                  {a.pauta && (
                    <p className="mt-2 text-sm text-slate-400 line-clamp-2 whitespace-pre-wrap">
                      {a.pauta}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
