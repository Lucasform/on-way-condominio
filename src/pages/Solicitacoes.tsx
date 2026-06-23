import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSolicitacoes, updateSolicitacaoStatus } from '../lib/solicitacoes'
import type { Solicitacao, StatusSolicitacao } from '../types/solicitacao'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Fab from '../components/ui/Fab'
import EmptyState from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { CardListSkeleton } from '../components/ui/Skeleton'

const TIPO_LABEL = { duvida: 'Dúvida', reclamacao: 'Reclamação', sugestao: 'Sugestão', outros: 'Outros' }
const TIPO_CLASS = {
  duvida:     'bg-sky-500/10 text-sky-300 border-sky-500/30',
  reclamacao: 'bg-red-500/10 text-red-300 border-red-500/30',
  sugestao:   'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  outros:     'bg-slate-500/15 text-slate-300 border-slate-500/40',
}

const COLUNAS: { status: StatusSolicitacao; label: string; description: string; color: string }[] = [
  { status: 'enviado',    label: 'Enviado',    description: 'Aguardando triagem da gestão',      color: 'border-amber-500/40 bg-amber-500/5' },
  { status: 'analise',   label: 'Em análise', description: 'Em avaliação pela administração',    color: 'border-sky-500/40 bg-sky-500/5' },
  { status: 'respondido',label: 'Respondido', description: 'Atendidas ou encerradas',            color: 'border-emerald-500/40 bg-emerald-500/5' },
]

export default function Solicitacoes() {
  const { user, perfil } = useAuth()
  const gestor = isGestor(perfil?.role)
  const toast = useToast()

  const [items, setItems] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!perfil) return
    setLoading(true)
    try {
      const data = await listSolicitacoes(
        gestor
          ? { condominio_id: perfil.condominio_id ?? undefined }
          : { autor_id: user?.id }
      )
      setItems(data)
    } catch (e) {
      toast.error('Erro ao carregar', e instanceof Error ? e.message : '')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [perfil?.condominio_id, user?.id])

  async function moverStatus(id: string, status: StatusSolicitacao) {
    try {
      await updateSolicitacaoStatus(id, status)
      setItems((prev) => prev.map((s) => s.id === id ? { ...s, status } : s))
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader title="Solicitações" subtitle="Canal de comunicação com a gestão." />
        <CardListSkeleton rows={3} />
      </div>
    )
  }

  // ================================================================
  // Morador — lista simples + FAB para nova
  // ================================================================
  if (!gestor) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader
          title="Minhas solicitações"
          subtitle="Acompanhe suas dúvidas, reclamações e sugestões."
        />

        {items.length === 0 ? (
          <EmptyState
            icon="📩"
            message="Nenhuma solicitação ainda."
            hint="Envie uma dúvida, reclamação ou sugestão para a gestão do condomínio."
            action={<Link to="/solicitacoes/nova" className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition">Nova solicitação</Link>}
          />
        ) : (
          <div className="space-y-3">
            {items.map((s) => (
              <Link
                key={s.id}
                to={`/solicitacoes/${s.id}`}
                className="block rounded-xl border border-slate-700 bg-slate-900/40 p-4 hover:border-slate-500 hover:bg-slate-800/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{s.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.descricao}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={s.status} />
                    <span className={`text-[10px] border rounded-full px-2 py-0.5 ${TIPO_CLASS[s.tipo]}`}>
                      {TIPO_LABEL[s.tipo]}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 mt-2">{fmtTs(s.created_at)}</p>
              </Link>
            ))}
          </div>
        )}

        <Fab to="/solicitacoes/nova" label="Nova solicitação" />
      </div>
    )
  }

  // ================================================================
  // Gestor — Kanban
  // ================================================================
  const byStatus = (status: StatusSolicitacao) => items.filter((s) => s.status === status)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1600px] mx-auto">
      <PageHeader
        title="Solicitações"
        subtitle={`${items.length} solicitação${items.length !== 1 ? 'ões' : ''} recebida${items.length !== 1 ? 's' : ''}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUNAS.map((col) => {
          const cards = byStatus(col.status)
          return (
            <div key={col.status} className={`rounded-lg border p-3 flex flex-col min-h-[300px] ${col.color}`}>
              <header className="mb-3 px-1">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">{col.label}</h2>
                  <span className="text-xs text-slate-500 font-mono">{cards.length}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">{col.description}</p>
              </header>

              {cards.length === 0 && (
                <div className="text-center text-xs text-slate-600 py-8">vazio</div>
              )}

              <div className="space-y-3">
                {cards.map((s) => (
                  <KanbanCard
                    key={s.id}
                    s={s}
                    onMover={moverStatus}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KanbanCard({
  s,
  onMover,
}: {
  s: Solicitacao
  onMover: (id: string, status: StatusSolicitacao) => void
}) {
  const nextStatus = (curr: StatusSolicitacao): StatusSolicitacao | null => {
    if (curr === 'enviado') return 'analise'
    if (curr === 'analise') return 'respondido'
    return null
  }
  const prevStatus = (curr: StatusSolicitacao): StatusSolicitacao | null => {
    if (curr === 'respondido') return 'analise'
    if (curr === 'analise') return 'enviado'
    return null
  }
  const next = nextStatus(s.status)
  const prev = prevStatus(s.status)

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 hover:border-slate-600 transition group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`text-[10px] border rounded-full px-2 py-0.5 shrink-0 ${TIPO_CLASS[s.tipo]}`}>
          {TIPO_LABEL[s.tipo]}
        </span>
        <span className="text-[10px] text-slate-600">{fmtTs(s.created_at)}</span>
      </div>

      <Link to={`/solicitacoes/${s.id}`} className="block group-hover:text-brand-300 transition">
        <p className="text-sm font-semibold text-slate-100 leading-snug">{s.titulo}</p>
        {s.autor_nome && (
          <p className="text-xs text-slate-500 mt-0.5">{s.autor_nome}{s.unidade_nome ? ` · Unid. ${s.unidade_nome}` : ''}</p>
        )}
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.descricao}</p>
      </Link>

      <div className="flex gap-1.5 mt-3">
        {prev && (
          <button
            onClick={() => onMover(s.id, prev)}
            className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition"
          >
            ← Voltar
          </button>
        )}
        {next && (
          <button
            onClick={() => onMover(s.id, next)}
            className="text-[10px] px-2 py-0.5 rounded border border-brand-700/50 bg-brand-700/10 text-brand-300 hover:bg-brand-700/20 transition ml-auto"
          >
            Avançar →
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: StatusSolicitacao }) {
  const map: Record<StatusSolicitacao, { label: string; cls: string }> = {
    enviado:    { label: 'Enviado',    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    analise:    { label: 'Em análise',cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
    respondido: { label: 'Respondido',cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`text-[10px] border rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
  )
}

function fmtTs(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '' }
}
