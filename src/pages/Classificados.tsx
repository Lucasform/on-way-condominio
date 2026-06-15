import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClassificados } from '../lib/classificados'
import type { Classificado, CategoriaClassificado } from '../types/classificado'
import { CATEGORIA_LABEL, CATEGORIA_EMOJI } from '../types/classificado'
import { useAuth } from '../components/AuthProvider'
import { isStaff } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaClassificado[]

const STATUS_CLASS: Record<string, string> = {
  ativo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  vendido: 'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelado: 'bg-red-500/10 text-red-300 border-red-500/30',
}

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Disponível',
  vendido: 'Vendido',
  cancelado: 'Cancelado',
}

export default function Classificados() {
  const { perfil } = useAuth()
  const canManage = isStaff(perfil?.role)
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [rows, setRows] = useState<Classificado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<CategoriaClassificado | ''>('')
  const [showAll, setShowAll] = useState(false)

  const condoId = perfil?.condominio_id ?? undefined

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listClassificados({
        condominio_id: isAdmin ? undefined : condoId,
        categoria: catFilter || undefined,
        status: showAll ? undefined : 'ativo',
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [catFilter, showAll, condoId])

  const filtered = rows

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Classificados"
        subtitle="Anúncios do condomínio."
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <Link to="/classificados/novo">
                <Button>+ Novo anúncio</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCatFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            catFilter === ''
              ? 'bg-brand-600 border-brand-500 text-white'
              : 'border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          Todos
        </button>
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              catFilter === cat
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {CATEGORIA_EMOJI[cat]} {CATEGORIA_LABEL[cat]}
          </button>
        ))}
        {canManage && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`ml-auto px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              showAll
                ? 'bg-slate-700 border-slate-600 text-slate-200'
                : 'border-slate-700 text-slate-500 hover:border-slate-600'
            }`}
          >
            {showAll ? 'Mostrar só ativos' : 'Ver todos os status'}
          </button>
        )}
      </div>

      {loading && <TableSkeleton />}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          message="Nenhum anúncio"
          hint={canManage ? 'Clique em "+ Novo anúncio" para publicar o primeiro.' : 'Nenhum anúncio disponível no momento.'}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/classificados/${c.id}`}
              className="group rounded-lg border border-slate-800 bg-slate-900/40 hover:border-slate-700 overflow-hidden transition"
            >
              {c.fotos.length > 0 ? (
                <div className="aspect-video overflow-hidden bg-slate-800">
                  <img
                    src={c.fotos[0]}
                    alt={c.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-slate-800/60 flex items-center justify-center text-4xl">
                  {CATEGORIA_EMOJI[c.categoria]}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-100 line-clamp-2">{c.titulo}</h3>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  {CATEGORIA_EMOJI[c.categoria]} {CATEGORIA_LABEL[c.categoria]}
                </div>
                {c.preco != null ? (
                  <div className="text-base font-bold text-emerald-400">
                    R$ {c.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">A combinar</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
