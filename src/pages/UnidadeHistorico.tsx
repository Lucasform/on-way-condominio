import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUnidade } from '../lib/unidades'
import { getCondominio } from '../lib/condominios'
import { listOcorrencias } from '../lib/ocorrencias'
import { listMultas, MULTA_STATUS_LABEL } from '../lib/multas'
import { listChamados } from '../lib/chamados'
import { listEncomendas } from '../lib/encomendas'
import { listNotificacoes } from '../lib/notificacoes'
import { listAcessos } from '../lib/acessos'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Multa, StatusMulta } from '../types/multa'
import type { Chamado } from '../types/chamado'
import type { Encomenda } from '../types/encomenda'
import type { Notificacao } from '../types/notificacao'
import type { AcessoAutorizado } from '../types/acesso'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

type TimelineItem =
  | { kind: 'ocorrencia'; date: string; data: Ocorrencia }
  | { kind: 'multa'; date: string; data: Multa }
  | { kind: 'chamado'; date: string; data: Chamado }
  | { kind: 'encomenda'; date: string; data: Encomenda }
  | { kind: 'notificacao'; date: string; data: Notificacao }
  | { kind: 'acesso'; date: string; data: AcessoAutorizado }

const OCORR_STATUS_CLASS: Record<StatusOcorrencia, string> = {
  aberta: 'text-amber-300',
  em_analise: 'text-sky-300',
  arquivada: 'text-slate-400',
  virou_multa: 'text-red-300',
  cancelada: 'text-slate-500',
}

const OCORR_STATUS_LABEL: Record<StatusOcorrencia, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  arquivada: 'Arquivada',
  virou_multa: 'Virou multa',
  cancelada: 'Cancelada',
}

const MULTA_STATUS_CLASS: Record<StatusMulta, string> = {
  em_analise: 'text-amber-300',
  aplicada: 'text-red-300',
  paga: 'text-emerald-300',
  contestada: 'text-orange-300',
  cancelada: 'text-slate-500',
  arquivada: 'text-slate-400',
  pendente_aprovacao: 'text-violet-300',
}

export default function UnidadeHistorico() {
  const { id } = useParams()
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      try {
        const u = await getUnidade(id)
        if (!mounted) return
        if (!u) {
          setError('Unidade não encontrada.')
          setLoading(false)
          return
        }
        setUnidade(u)
        const [co, ocorrs, multas, chams, encs, notifs, acessos] = await Promise.all([
          getCondominio(u.condominio_id),
          listOcorrencias({ condominio_id: u.condominio_id }),
          listMultas({ condominio_id: u.condominio_id, unidade_id: u.id }),
          listChamados({ condominio_id: u.condominio_id }).catch(() => []),
          listEncomendas({ condominio_id: u.condominio_id, unidade_id: u.id }).catch(() => []),
          listNotificacoes({ condominio_id: u.condominio_id }).catch(() => []),
          listAcessos({ condominio_id: u.condominio_id, unidade_id: u.id }).catch(() => []),
        ])
        if (!mounted) return
        setCondominio(co)
        const ocorrsFiltered = ocorrs.filter((o) => o.unidade_id === u.id)
        const chamsFiltered = chams.filter((c) => c.unidade_id === u.id)
        const notifsFiltered = notifs.filter((n) => n.unidade_id === u.id)
        const merged: TimelineItem[] = [
          ...ocorrsFiltered.map((o) => ({ kind: 'ocorrencia' as const, date: o.created_at, data: o })),
          ...multas.map((m) => ({ kind: 'multa' as const, date: m.created_at, data: m })),
          ...chamsFiltered.map((c) => ({ kind: 'chamado' as const, date: c.created_at, data: c })),
          ...encs.map((e) => ({ kind: 'encomenda' as const, date: e.created_at, data: e })),
          ...notifsFiltered.map((n) => ({ kind: 'notificacao' as const, date: n.created_at, data: n })),
          ...acessos.map((a) => ({ kind: 'acesso' as const, date: a.created_at, data: a })),
        ].sort((a, b) => (a.date < b.date ? 1 : -1))
        setItems(merged)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  if (error || !unidade) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader
          title="Histórico"
          actions={<Link to="/unidades"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const unidadeLabel = unidade.bloco ? `${unidade.bloco} - ${unidade.numero}` : unidade.numero
  const count = (k: TimelineItem['kind']) => items.filter((i) => i.kind === k).length
  const totalMultas = items
    .filter((i): i is TimelineItem & { kind: 'multa' } => i.kind === 'multa')
    .reduce((sum, i) => sum + Number(i.data.valor), 0)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Histórico — ${unidadeLabel}`}
        subtitle={`${condominio?.nome ?? '—'} · ${unidade.tipo}`}
        actions={
          <Link to="/unidades">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Stat label="Ocorrências" value={count('ocorrencia')} />
        <Stat label="Multas" value={count('multa')} />
        <Stat label="Chamados" value={count('chamado')} />
        <Stat label="Encomendas" value={count('encomenda')} />
        <Stat label="Notificações" value={count('notificacao')} />
        <Stat label="Acessos" value={count('acesso')} />
        <Stat label="Total multas" value={`R$ ${totalMultas.toFixed(2).replace('.', ',')}`} />
      </div>

      {items.length === 0 ? (
        <EmptyState message="Sem registros para esta unidade." />
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.kind === 'ocorrencia' ? (
              <Link
                key={`o-${item.data.id}`}
                to={`/ocorrencias/${item.data.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-2 h-2 mt-2 rounded-full bg-sky-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(item.data.created_at).toLocaleString('pt-BR')}</span>
                      <span>·</span>
                      <span className="uppercase tracking-wide text-slate-400">Ocorrência</span>
                      <span>·</span>
                      <span className={OCORR_STATUS_CLASS[item.data.status]}>{OCORR_STATUS_LABEL[item.data.status]}</span>
                    </div>
                    {item.data.local && (
                      <div className="text-xs text-slate-400 mt-0.5">{item.data.local}</div>
                    )}
                    <p className="mt-1 text-sm text-slate-200 line-clamp-2">{item.data.descricao}</p>
                  </div>
                </div>
              </Link>
            ) : item.kind === 'multa' ? (
              <Link
                key={`m-${item.data.id}`}
                to={`/multas/${item.data.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-2 h-2 mt-2 rounded-full bg-red-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(item.data.created_at).toLocaleString('pt-BR')}</span>
                      <span>·</span>
                      <span className="uppercase tracking-wide text-slate-400">Multa</span>
                      <span>·</span>
                      <span className={MULTA_STATUS_CLASS[item.data.status]}>
                        {MULTA_STATUS_LABEL[item.data.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="text-base font-semibold text-slate-100">
                        R$ {Number(item.data.valor).toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-sm text-slate-300 line-clamp-1">{item.data.descricao}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <GenericLine key={`${item.kind}-${item.data.id}`} item={item} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  )
}

const KIND_META: Record<TimelineItem['kind'], { label: string; dot: string; route: string }> = {
  ocorrencia: { label: 'Ocorrência', dot: 'bg-sky-400', route: '/ocorrencias' },
  multa: { label: 'Multa', dot: 'bg-red-400', route: '/multas' },
  chamado: { label: 'Chamado', dot: 'bg-amber-400', route: '/chamados' },
  encomenda: { label: 'Encomenda', dot: 'bg-emerald-400', route: '/encomendas' },
  notificacao: { label: 'Notificação', dot: 'bg-violet-400', route: '/notificacoes' },
  acesso: { label: 'Acesso', dot: 'bg-cyan-400', route: '/acessos' },
}

function GenericLine({ item }: { item: TimelineItem }) {
  const meta = KIND_META[item.kind]
  const id = (item.data as { id: string }).id
  let resumo = ''
  if (item.kind === 'chamado') {
    const c = item.data
    resumo = c.titulo ?? c.descricao?.slice(0, 100) ?? 'Chamado'
  } else if (item.kind === 'encomenda') {
    const e = item.data
    resumo = `${e.tipo}${e.descricao ? ` · ${e.descricao.slice(0, 80)}` : ''}`
  } else if (item.kind === 'notificacao') {
    resumo = item.data.descricao?.slice(0, 100) ?? 'Notificação'
  } else if (item.kind === 'acesso') {
    resumo = `${item.data.tipo} · ${item.data.nome}`
  }
  return (
    <Link
      to={`${meta.route}/${id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-2 h-2 mt-2 rounded-full ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{new Date(item.date).toLocaleString('pt-BR')}</span>
            <span>·</span>
            <span className="uppercase tracking-wide text-slate-400">{meta.label}</span>
          </div>
          <div className="mt-1 text-sm text-slate-200 line-clamp-2">{resumo || meta.label}</div>
        </div>
      </div>
    </Link>
  )
}

