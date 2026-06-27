import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listOcorrencias, updateOcorrenciaStatus } from '../lib/ocorrencias'
import { listMultas, changeMultaStatus } from '../lib/multas'
import { listChamados, updateChamadoStatus } from '../lib/chamados'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Multa, StatusMulta } from '../types/multa'
import type { Chamado, StatusChamado } from '../types/chamado'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { usePrompt } from '../components/ui/PromptProvider'
import PageHeader from '../components/ui/PageHeader'
import ShortcutsBar from '../components/ui/ShortcutsBar'
import Tabs from '../components/ui/Tabs'
import { Select } from '../components/ui/Input'

// ----------------------------------------------------------------
// Modelo do painel: cards unificados de ocorrências e multas
// fluindo por 5 colunas no estilo Kanban.
// ----------------------------------------------------------------

type CardKind = 'ocorrencia' | 'multa' | 'chamado'

interface Card {
  kind: CardKind
  id: string
  unidadeId: string | null
  title: string
  subtitle: string
  date: string
  status: string
  valor?: number
}

type ColumnKey = 'chegou' | 'analise' | 'envio' | 'em_curso' | 'finalizada'

const COLUMNS: { key: ColumnKey; label: string; description: string; accent: string }[] = [
  {
    key: 'chegou',
    label: 'Entrada',
    description: 'Itens novos aguardando triagem',
    accent: 'border-amber-500/40 bg-amber-500/5',
  },
  {
    key: 'analise',
    label: 'Em análise',
    description: 'Sob avaliação da gestão',
    accent: 'border-sky-500/40 bg-sky-500/5',
  },
  {
    key: 'envio',
    label: 'Pré-envio',
    description: 'Multa em rascunho aguardando aplicação',
    accent: 'border-orange-500/40 bg-orange-500/5',
  },
  {
    key: 'em_curso',
    label: 'Em curso',
    description: 'Trabalho em andamento ou contestado',
    accent: 'border-red-500/40 bg-red-500/5',
  },
  {
    key: 'finalizada',
    label: 'Encerrados',
    description: 'Resolvidos, pagos, arquivados ou cancelados',
    accent: 'border-emerald-500/30 bg-emerald-500/5',
  },
]

function ocorrenciaColumn(o: Ocorrencia): ColumnKey {
  switch (o.status as StatusOcorrencia) {
    case 'aberta':
      return 'chegou'
    case 'em_analise':
      return 'analise'
    case 'virou_multa':
      // Esses casos vão pra coluna correspondente DA MULTA (já está no fluxo de multas).
      // Mas se a multa ainda não existir/visível, exibimos como finalizada.
      return 'finalizada'
    case 'arquivada':
    case 'cancelada':
      return 'finalizada'
  }
}

function multaColumn(m: Multa): ColumnKey {
  switch (m.status as StatusMulta) {
    case 'em_analise':
      return 'envio' // pendente de aplicar
    case 'aplicada':
    case 'contestada':
      return 'em_curso'
    case 'paga':
    case 'cancelada':
    case 'arquivada':
      return 'finalizada'
  }
}

function chamadoColumn(c: Chamado): ColumnKey {
  switch (c.status as StatusChamado) {
    case 'aberto':
      return 'chegou'
    case 'em_andamento':
    case 'aguardando':
    case 'resolvido':
      return 'em_curso'
    case 'finalizado':
    case 'cancelado':
      return 'finalizada'
  }
}

export default function Painel() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const prompt = usePrompt()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [multas, setMultas] = useState<Multa[]>([])
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<'tudo' | 'ocorrencias' | 'multas' | 'chamados'>('tudo')

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
      const cid = isAdmin && scopeId ? scopeId : undefined
      const [oRows, mRows, cRows] = await Promise.all([
        listOcorrencias({ condominio_id: cid }),
        listMultas({ condominio_id: cid }),
        listChamados({ condominio_id: cid }),
      ])
      setOcorrencias(oRows)
      setMultas(mRows)
      setChamados(cRows)
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
  }, [scopeId])

  // Constrói cards e agrupa por coluna
  const cards = useMemo<Record<ColumnKey, Card[]>>(() => {
    const acc: Record<ColumnKey, Card[]> = {
      chegou: [],
      analise: [],
      envio: [],
      em_curso: [],
      finalizada: [],
    }

    const unidadeLabel = (uid: string | null) => {
      if (!uid) return 'Área comum'
      const u = unidades.find((x) => x.id === uid)
      return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
    }

    // Ocorrências que NÃO viraram multa entram no fluxo
    if (tipoFiltro === 'tudo' || tipoFiltro === 'ocorrencias')
    for (const o of ocorrencias) {
      if (o.status === 'virou_multa') continue // a multa correspondente representa
      const col = ocorrenciaColumn(o)
      acc[col].push({
        kind: 'ocorrencia',
        id: o.id,
        unidadeId: o.unidade_id,
        title: o.descricao.slice(0, 80) + (o.descricao.length > 80 ? '…' : ''),
        subtitle: `${unidadeLabel(o.unidade_id)}${o.local ? ` · ${o.local}` : ''}`,
        date: o.created_at,
        status: o.status,
      })
    }

    // Multas: cada multa entra em sua coluna
    if (tipoFiltro === 'tudo' || tipoFiltro === 'multas')
    for (const m of multas) {
      const col = multaColumn(m)
      acc[col].push({
        kind: 'multa',
        id: m.id,
        unidadeId: m.unidade_id,
        title: m.descricao.slice(0, 80) + (m.descricao.length > 80 ? '…' : ''),
        subtitle: `${unidadeLabel(m.unidade_id)}${m.artigo_regimento ? ` · ${m.artigo_regimento}` : ''}`,
        date: m.created_at,
        status: m.status,
        valor: Number(m.valor),
      })
    }

    // Chamados: cada chamado entra em sua coluna (visualizacao; avancos pelo detalhe)
    if (tipoFiltro === 'tudo' || tipoFiltro === 'chamados')
    for (const c of chamados) {
      const col = chamadoColumn(c)
      acc[col].push({
        kind: 'chamado',
        id: c.id,
        unidadeId: c.unidade_id,
        title: c.titulo.slice(0, 80) + (c.titulo.length > 80 ? '…' : ''),
        subtitle: `${unidadeLabel(c.unidade_id)} · ${c.categoria}`,
        date: c.created_at,
        status: c.status,
      })
    }

    // Ordena cada coluna por data desc
    for (const k of Object.keys(acc) as ColumnKey[]) {
      acc[k].sort((a, b) => (a.date < b.date ? 1 : -1))
    }
    return acc
  }, [ocorrencias, multas, chamados, unidades, tipoFiltro])

  async function quickAdvance(card: Card) {
    try {
      if (card.kind === 'ocorrencia') {
        if (card.status === 'aberta') {
          await updateOcorrenciaStatus(card.id, 'em_analise')
        } else if (card.status === 'em_analise') {
          // Não avança sozinho — síndico precisa abrir e decidir (gerar multa, arquivar, etc.)
          navigate(`/ocorrencias/${card.id}`)
          return
        }
      } else if (card.kind === 'multa') {
        if (card.status === 'em_analise') {
          navigate(`/multas/${card.id}`)
          return
        } else if (card.status === 'aplicada') {
          // Marca paga (atalho rápido). Síndico pode fazer outras transições no detalhe.
          const ok = await confirm({ message: 'Marcar multa como PAGA?', confirmText: 'Marcar paga' })
          if (!ok) return
          await changeMultaStatus(card.id, 'paga')
        }
      } else if (card.kind === 'chamado') {
        if (card.status === 'aberto') {
          await updateChamadoStatus(card.id, 'em_andamento')
        } else if (card.status === 'resolvido') {
          const ok = await confirm({ message: 'Finalizar esse chamado?', confirmText: 'Finalizar' })
          if (!ok) return
          await updateChamadoStatus(card.id, 'finalizado')
        } else {
          navigate(`/chamados/${card.id}`)
          return
        }
      }
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  // Regras do fluxo: dado um card, em quais colunas ele pode ser solto.
  function canDropOn(card: Card, target: ColumnKey): boolean {
    // Chamado: drag-drop nao implementado nessa rodada (avanca pelo detalhe)
    if (card.kind === 'chamado') return false

    const from = card.kind === 'ocorrencia'
      ? ocorrenciaColumn({ status: card.status } as Ocorrencia)
      : multaColumn({ status: card.status } as Multa)
    if (from === target) return false
    if (card.kind === 'ocorrencia') {
      if (card.status === 'aberta') return target === 'analise' || target === 'finalizada'
      if (card.status === 'em_analise') return target === 'finalizada' // arquivar; virar multa só pelo detalhe
      return false
    }
    // multa
    if (card.status === 'em_analise') return target === 'em_curso' || target === 'finalizada'
    if (card.status === 'aplicada' || card.status === 'contestada') return target === 'finalizada'
    return false
  }

  async function moveCard(card: Card, target: ColumnKey) {
    if (!canDropOn(card, target)) return
    try {
      if (card.kind === 'ocorrencia') {
        if (card.status === 'aberta' && target === 'analise') {
          await updateOcorrenciaStatus(card.id, 'em_analise')
        } else if (target === 'finalizada') {
          const ok = await confirm({ message: 'Arquivar essa ocorrência?', confirmText: 'Arquivar' })
          if (!ok) return
          await updateOcorrenciaStatus(card.id, 'arquivada')
        }
      } else {
        if (card.status === 'em_analise' && target === 'em_curso') {
          const ok = await confirm({ message: 'Aplicar multa agora?', confirmText: 'Aplicar' })
          if (!ok) return
          await changeMultaStatus(card.id, 'aplicada')
        } else if (target === 'finalizada') {
          const opt = await prompt({
            title: 'Finalizar multa',
            message: 'Selecione como a multa será finalizada:',
            options: [
              { value: 'paga', label: 'Paga' },
              { value: 'cancelada', label: 'Cancelada' },
              { value: 'arquivada', label: 'Arquivada' },
            ],
          })
          if (!opt) return
          await changeMultaStatus(card.id, opt as StatusMulta)
        }
      }
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  const canAct = !!(perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role))

  const [draggingCard, setDraggingCard] = useState<Card | null>(null)
  const [hoverCol, setHoverCol] = useState<ColumnKey | null>(null)

  const isGestor = perfil && ['administradora', 'sindico', 'subsindico', 'admin_onway'].includes(perfil.role)
  const multasPendAprov = isGestor
    ? multas.filter((m) => m.status === 'pendente_aprovacao' && m.criado_por !== perfil?.id)
    : []
  const chamadosPendAprov = isGestor
    ? chamados.filter((c) => c.status === 'pendente_aprovacao')
    : []
  const pendentesAprovacao =
    isGestor && (multasPendAprov.length > 0 || chamadosPendAprov.length > 0) ? (
      <div className="mb-5 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="text-xs font-semibold text-violet-300 mb-2">
          🔔 Aguardando sua aprovação ({multasPendAprov.length + chamadosPendAprov.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {multasPendAprov.map((m) => (
            <Link key={m.id} to={`/multas/${m.id}`}
              className="text-xs px-2 py-1 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition">
              💰 Multa — {m.descricao.slice(0, 40)}
            </Link>
          ))}
          {chamadosPendAprov.map((c) => (
            <Link key={c.id} to={`/chamados/${c.id}`}
              className="text-xs px-2 py-1 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition">
              🛠 Chamado — {c.titulo.slice(0, 40)}
            </Link>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Painel de trabalho"
        subtitle="Pipeline de ocorrências, multas e chamados. Use as colunas pra ver onde está o trabalho."
      />
      <ShortcutsBar role={perfil?.role} userId={perfil?.id} />

      {/* N2: Widget de aprovações pendentes para gestores */}
      {pendentesAprovacao}

      <div className="mb-5 flex gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <Link to="/ocorrencias/novo" className="text-brand-400 hover:underline">+ Nova ocorrência</Link>
          <span className="text-slate-700">·</span>
          <Link to="/chamados/novo" className="text-brand-400 hover:underline">+ Novo chamado</Link>
        </div>
      </div>

      <Tabs
        className="mb-4"
        value={tipoFiltro}
        onChange={(k) => setTipoFiltro(k as typeof tipoFiltro)}
        tabs={[
          { key: 'tudo', label: 'Tudo' },
          { key: 'ocorrencias', label: 'Ocorrências', icon: '⚠️' },
          { key: 'multas', label: 'Multas', icon: '💰' },
          { key: 'chamados', label: 'Chamados', icon: '🛠' },
        ]}
      />

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Carregando painel...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const list = cards[col.key]
            const isHover = hoverCol === col.key
            const isValidTarget = draggingCard ? canDropOn(draggingCard, col.key) : false
            const isInvalidHover = isHover && draggingCard && !isValidTarget
            return (
              <section
                key={col.key}
                onDragOver={(e) => {
                  if (!draggingCard) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = canDropOn(draggingCard, col.key) ? 'move' : 'none'
                  setHoverCol(col.key)
                }}
                onDragLeave={() => setHoverCol((h) => (h === col.key ? null : h))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingCard && canDropOn(draggingCard, col.key)) {
                    moveCard(draggingCard, col.key)
                  }
                  setDraggingCard(null)
                  setHoverCol(null)
                }}
                className={`rounded-lg border ${col.accent} p-3 flex flex-col min-h-[400px] transition-all ${
                  isHover && isValidTarget ? 'ring-2 ring-emerald-500 scale-[1.01]' : ''
                } ${isInvalidHover ? 'ring-2 ring-red-500/50 opacity-70' : ''}`}
              >
                <header className="mb-3 px-1">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">{col.label}</h2>
                    <span className="text-xs text-slate-500 font-mono">{list.length}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{col.description}</p>
                </header>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="text-center text-xs text-slate-600 py-8">vazio</div>
                  ) : (
                    list.map((card) => (
                      <CardItem
                        key={`${card.kind}-${card.id}`}
                        card={card}
                        canAct={canAct}
                        onClick={() => {
                          const path =
                            card.kind === 'ocorrencia'
                              ? `/ocorrencias/${card.id}`
                              : card.kind === 'multa'
                              ? `/multas/${card.id}`
                              : `/chamados/${card.id}`
                          navigate(path)
                        }}
                        onAdvance={() => quickAdvance(card)}
                        onDragStart={() => canAct && setDraggingCard(card)}
                        onDragEnd={() => { setDraggingCard(null); setHoverCol(null) }}
                        dragging={draggingCard?.id === card.id}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-600">
        Dica: clique em qualquer card pra abrir o detalhe. Os botões de avanço rápido só aparecem onde a próxima ação é óbvia.
      </p>
    </div>
  )
}

// ----------------------------------------------------------------

function CardItem({
  card,
  canAct,
  onClick,
  onAdvance,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  card: Card
  canAct: boolean
  onClick: () => void
  onAdvance: () => void
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const isMulta = card.kind === 'multa'
  const isChamado = card.kind === 'chamado'
  const draggable = canAct && !isChamado // chamado nao tem drag-drop nessa rodada
  const advanceLabel = getAdvanceLabel(card)

  const badge = isChamado
    ? { cls: 'bg-orange-500/15 text-orange-300', label: '🔧 chamado' }
    : isMulta
    ? { cls: 'bg-red-500/15 text-red-300', label: '💰 multa' }
    : { cls: 'bg-sky-500/15 text-sky-300', label: '📋 ocorrência' }

  return (
    <article
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className={`rounded-md border border-slate-800 bg-slate-900/60 p-3 cursor-pointer hover:border-slate-600 transition ${
        dragging ? 'opacity-40 ring-2 ring-brand-700' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${badge.cls}`}>
          {badge.label}
        </span>
        {isMulta && card.valor != null && (
          <span className="text-xs font-semibold text-slate-200 ml-auto">
            R$ {card.valor.toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-100 leading-snug line-clamp-2">{card.title}</p>
      <p className="text-xs text-slate-500 mt-1">{card.subtitle}</p>
      <p className="text-[10px] text-slate-600 mt-1.5 font-mono">
        {new Date(card.date).toLocaleDateString('pt-BR')}
      </p>

      {canAct && advanceLabel && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAdvance()
          }}
          className="mt-2 w-full text-xs px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          {advanceLabel}
        </button>
      )}
    </article>
  )
}

function getAdvanceLabel(card: Card): string | null {
  if (card.kind === 'ocorrencia') {
    if (card.status === 'aberta') return '→ Mover pra análise'
    if (card.status === 'em_analise') return '→ Abrir e decidir'
    return null
  }
  if (card.kind === 'multa') {
    if (card.status === 'em_analise') return '→ Aplicar / cancelar'
    if (card.status === 'aplicada') return '✓ Marcar paga'
    return null
  }
  // chamado
  if (card.status === 'aberto') return '→ Iniciar atendimento'
  if (card.status === 'resolvido') return '✓ Finalizar'
  return null
}

