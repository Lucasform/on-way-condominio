import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPessoa } from '../lib/pessoas'
import { getUnidade } from '../lib/unidades'
import { listOcorrencias } from '../lib/ocorrencias'
import { listMultas, MULTA_STATUS_LABEL } from '../lib/multas'
import { listChamados } from '../lib/chamados'
import { listEncomendas } from '../lib/encomendas'
import { listNotificacoes } from '../lib/notificacoes'
import type { Pessoa } from '../types/pessoa'
import type { Unidade } from '../types/unidade'
import type { Ocorrencia } from '../types/ocorrencia'
import type { Multa } from '../types/multa'
import type { Chamado } from '../types/chamado'
import type { Encomenda } from '../types/encomenda'
import type { Notificacao } from '../types/notificacao'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

type TimelineItem =
  | { kind: 'ocorrencia'; date: string; data: Ocorrencia }
  | { kind: 'multa'; date: string; data: Multa }
  | { kind: 'chamado'; date: string; data: Chamado }
  | { kind: 'encomenda'; date: string; data: Encomenda }
  | { kind: 'notificacao'; date: string; data: Notificacao }

const KIND_LABEL: Record<TimelineItem['kind'], string> = {
  ocorrencia: 'Ocorrência',
  multa: 'Multa',
  chamado: 'Chamado',
  encomenda: 'Encomenda',
  notificacao: 'Notificação',
}

const KIND_DOT: Record<TimelineItem['kind'], string> = {
  ocorrencia: 'bg-sky-400',
  multa: 'bg-red-400',
  chamado: 'bg-amber-400',
  encomenda: 'bg-emerald-400',
  notificacao: 'bg-violet-400',
}

const KIND_ROUTE: Record<TimelineItem['kind'], string> = {
  ocorrencia: '/ocorrencias',
  multa: '/multas',
  chamado: '/chamados',
  encomenda: '/encomendas',
  notificacao: '/notificacoes',
}

const FILTROS: TimelineItem['kind'][] = ['ocorrencia', 'multa', 'chamado', 'encomenda', 'notificacao']

export default function PessoaHistorico() {
  const { id } = useParams()
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [filtros, setFiltros] = useState<Set<TimelineItem['kind']>>(new Set(FILTROS))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      try {
        const p = await getPessoa(id)
        if (!mounted) return
        if (!p) {
          setError('Pessoa não encontrada.')
          setLoading(false)
          return
        }
        setPessoa(p)
        const un = p.unidade_id ? await getUnidade(p.unidade_id) : null
        if (mounted) setUnidade(un)

        const [ocorrs, multas, chamados, encs, notifs] = await Promise.all([
          // ocorrencias: pessoa pode aparecer como pessoa_envolvida_id
          listOcorrencias({ condominio_id: p.condominio_id }).then((rows) =>
            rows.filter((o) => o.pessoa_envolvida_id === p.id || (p.user_id && o.reportado_por === p.user_id)),
          ),
          listMultas({ pessoa_id: p.id }),
          listChamados({ condominio_id: p.condominio_id }).then((rows) =>
            rows.filter((c) => p.user_id && c.aberto_por === p.user_id),
          ),
          p.unidade_id
            ? listEncomendas({ unidade_id: p.unidade_id }).catch(() => [])
            : Promise.resolve([] as Encomenda[]),
          listNotificacoes({ pessoa_id: p.id }).catch(() => [] as Notificacao[]),
        ])

        const merged: TimelineItem[] = [
          ...ocorrs.map((o) => ({ kind: 'ocorrencia' as const, date: o.created_at, data: o })),
          ...multas.map((m) => ({ kind: 'multa' as const, date: m.created_at, data: m })),
          ...chamados.map((c) => ({ kind: 'chamado' as const, date: c.created_at, data: c })),
          ...encs.map((e) => ({ kind: 'encomenda' as const, date: e.created_at, data: e })),
          ...notifs.map((n) => ({ kind: 'notificacao' as const, date: n.created_at, data: n })),
        ].sort((a, b) => (a.date < b.date ? 1 : -1))

        if (mounted) setItems(merged)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando histórico...</div>

  if (error || !pessoa) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader
          title="Histórico"
          actions={<Link to="/pessoas"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const visiveis = items.filter((i) => filtros.has(i.kind))
  const counts = FILTROS.reduce<Record<string, number>>((acc, k) => {
    acc[k] = items.filter((i) => i.kind === k).length
    return acc
  }, {})

  const totalMultas = items
    .filter((i): i is TimelineItem & { kind: 'multa' } => i.kind === 'multa')
    .reduce((sum, i) => sum + Number(i.data.valor), 0)

  const unidadeLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : null

  function toggleFiltro(k: TimelineItem['kind']) {
    setFiltros((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Histórico — ${pessoa.nome}`}
        subtitle={unidadeLabel ? `Un. ${unidadeLabel}` : 'Sem unidade vinculada'}
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/pessoas/${pessoa.id}`}>
              <Button variant="secondary">Editar pessoa</Button>
            </Link>
            <Link to="/pessoas">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FILTROS.map((k) => (
          <button
            key={k}
            onClick={() => toggleFiltro(k)}
            className={`rounded-lg border p-3 text-left transition ${
              filtros.has(k)
                ? 'border-slate-700 bg-slate-900/60'
                : 'border-slate-800 bg-slate-900/20 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${KIND_DOT[k]}`} />
              <div className="text-xs text-slate-500 uppercase tracking-wide truncate">{KIND_LABEL[k]}</div>
            </div>
            <div className="mt-1 text-xl font-bold text-slate-100">{counts[k] ?? 0}</div>
          </button>
        ))}
      </div>

      {totalMultas > 0 && (
        <div className="mb-4 text-sm text-slate-300">
          Total em multas: <strong>R$ {totalMultas.toFixed(2).replace('.', ',')}</strong>
        </div>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          message={
            items.length === 0
              ? 'Nada registrado para essa pessoa ainda.'
              : 'Nenhum item no filtro atual.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visiveis.map((item) => (
            <Link
              key={`${item.kind}-${(item.data as { id: string }).id}`}
              to={`${KIND_ROUTE[item.kind]}/${(item.data as { id: string }).id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-2 h-2 mt-2 rounded-full ${KIND_DOT[item.kind]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{new Date(item.date).toLocaleString('pt-BR')}</span>
                    <span>·</span>
                    <span className="uppercase tracking-wide text-slate-400">{KIND_LABEL[item.kind]}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-200">{describe(item)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function describe(item: TimelineItem): string {
  switch (item.kind) {
    case 'ocorrencia':
      return item.data.descricao.slice(0, 200)
    case 'multa':
      return `R$ ${Number(item.data.valor).toFixed(2).replace('.', ',')} — ${MULTA_STATUS_LABEL[item.data.status]} — ${item.data.descricao.slice(0, 150)}`
    case 'chamado':
      return `${item.data.titulo} (${item.data.status.replace('_', ' ')})`
    case 'encomenda':
      return `${item.data.tipo} — ${item.data.status} — ${item.data.descricao ?? ''}`
    case 'notificacao':
      return `${item.data.assunto} — ${item.data.descricao?.slice(0, 150) ?? ''}`
  }
}

