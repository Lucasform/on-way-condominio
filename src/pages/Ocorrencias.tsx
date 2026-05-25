import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOcorrencias, getOcorrenciaFotoSignedUrl } from '../lib/ocorrencias'
import { listUnidades } from '../lib/unidades'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Unidade } from '../types/unidade'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'

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
  const [rows, setRows] = useState<Ocorrencia[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [ocorrs, uns] = await Promise.all([listOcorrencias(), listUnidades()])
        if (!mounted) return
        setRows(ocorrs)
        setUnidades(uns)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

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

  return (
    <div className="px-8 py-10 max-w-5xl">
      <PageHeader
        title="Ocorrências"
        subtitle="Registros de incidentes e relatos no condomínio."
        actions={
          <Link to="/ocorrencias/novo">
            <Button>+ Nova ocorrência</Button>
          </Link>
        }
      />

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
          Nenhuma ocorrência registrada.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <article
              key={o.id}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex gap-4"
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
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <p className="mt-2 text-slate-200 whitespace-pre-wrap">{o.descricao}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
