import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listAcessos } from '../lib/acessos'
import { listUnidades } from '../lib/unidades'
import { isStaff } from '../lib/permissions'
import type { AcessoAutorizado, StatusAcesso, TipoAcesso } from '../types/acesso'
import type { Unidade } from '../types/unidade'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'

const STATUS_LABEL: Record<StatusAcesso, string> = {
  ativo: 'Ativo',
  usado: 'Entrou',
  expirado: 'Expirado',
  revogado: 'Revogado',
  negado: 'Negado',
}

const STATUS_CLASS: Record<StatusAcesso, string> = {
  ativo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  usado: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  expirado: 'bg-slate-700/40 text-slate-400 border-slate-700',
  revogado: 'bg-red-500/10 text-red-300 border-red-500/30',
  negado: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

const TIPO_EMOJI: Record<TipoAcesso, string> = {
  visitante: '👤',
  prestador: '🛠',
  entregador: '🛵',
  familiar: '👨‍👩‍👧',
  fixo: '🔁',
}

type Filtro = 'todos' | 'ativos' | 'hoje' | 'historico'

function isHoje(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// Verdade derivada: ativo no banco mas vigencia_fim ja passou = expirado pra UI.
function vigenciaExpirou(r: { status: StatusAcesso; vigencia_fim: string | null }): boolean {
  if (r.status !== 'ativo') return false
  if (!r.vigencia_fim) return false
  return new Date(r.vigencia_fim).getTime() < Date.now()
}

function statusEfetivo(r: { status: StatusAcesso; vigencia_fim: string | null }): StatusAcesso {
  return vigenciaExpirou(r) ? 'expirado' : r.status
}

export default function Acessos() {
  const { perfil } = useAuth()
  const staff = isStaff(perfil?.role)

  const [rows, setRows] = useState<AcessoAutorizado[]>([])
  const [unidadesMap, setUnidadesMap] = useState<Record<string, Unidade>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(staff ? 'hoje' : 'ativos')

  useEffect(() => {
    if (!perfil?.condominio_id) {
      setLoading(false)
      return
    }
    const condo = perfil.condominio_id
    Promise.all([
      listAcessos({ condominio_id: condo }),
      listUnidades({ condominio_id: condo, ativo: true }),
    ])
      .then(([acessos, unidades]) => {
        setRows(acessos)
        const map: Record<string, Unidade> = {}
        for (const u of unidades) map[u.id] = u
        setUnidadesMap(map)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [perfil])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const efetivo = statusEfetivo(r)
      if (filtro === 'ativos') return efetivo === 'ativo'
      if (filtro === 'hoje') {
        if (efetivo !== 'ativo') return false
        return isHoje(r.vigencia_inicio) || (r.vigencia_fim && isHoje(r.vigencia_fim))
      }
      if (filtro === 'historico') return efetivo !== 'ativo'
      return true
    })
  }, [rows, filtro])

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Acessos autorizados (${filtered.length})`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/acessos/evento">
              <Button variant="ghost">🎉 Em lote</Button>
            </Link>
            <Link to="/acessos/novo">
              <Button>+ Liberar acesso</Button>
            </Link>
          </div>
        }
      />

      <Tabs
        className="mb-4"
        value={filtro}
        onChange={(k) => setFiltro(k as Filtro)}
        tabs={[
          { key: 'ativos', label: 'Ativos' },
          { key: 'hoje', label: 'Hoje' },
          { key: 'historico', label: 'Histórico' },
          { key: 'todos', label: 'Todos' },
        ]}
      />

      {loading && <div className="text-slate-400 text-sm">Carregando...</div>}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-sm text-slate-500 italic rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          Nenhum acesso aqui ainda.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => {
            const u = r.unidade_id ? unidadesMap[r.unidade_id] : null
            return (
              <Link
                key={r.id}
                to={`/acessos/${r.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100">
                      {TIPO_EMOJI[r.tipo]} {r.nome}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {staff && u && <>Un. {u.bloco ? `${u.bloco}-${u.numero}` : u.numero} · </>}
                      Início {new Date(r.vigencia_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {r.vigencia_fim && (
                        <> · Fim {new Date(r.vigencia_fim).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                      )}
                    </div>
                    {r.observacao && (
                      <div className="text-xs text-slate-500 mt-1 italic line-clamp-1">{r.observacao}</div>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[statusEfetivo(r)]}`}>
                    {STATUS_LABEL[statusEfetivo(r)]}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

