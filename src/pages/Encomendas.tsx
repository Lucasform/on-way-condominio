import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEncomendas, darBaixaEncomenda, devolverEncomenda } from '../lib/encomendas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Encomenda, StatusEncomenda, TipoEncomenda } from '../types/encomenda'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'
import { Select } from '../components/ui/Input'
import { CardListSkeleton } from '../components/ui/Skeleton'

const STATUS_CLASS: Record<StatusEncomenda, string> = {
  aguardando: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  entregue: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  devolvida: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const STATUS_LABEL: Record<StatusEncomenda, string> = {
  aguardando: 'Aguardando',
  entregue: 'Entregue',
  devolvida: 'Devolvida',
}

const TIPO_ICON: Record<TipoEncomenda, string> = {
  encomenda: '📦',
  comida: '🍔',
  documento: '📄',
  outro: '📬',
}

const TIPO_LABEL: Record<TipoEncomenda, string> = {
  encomenda: 'Encomenda',
  comida: 'Comida',
  documento: 'Documento',
  outro: 'Outro',
}

export default function Encomendas() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const isMorador = perfil?.role === 'morador'

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Encomenda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'encomendas' | 'comida'>('encomendas')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const dataDeRef = useRef<HTMLInputElement>(null)
  const dataAteRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const podeBulk = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria'].includes(perfil.role)
  function toggleSelected(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  async function devolverSelecionadas() {
    if (selected.size === 0) return
    const ok = await confirm({ message: `Marcar ${selected.size} como devolvida(s)?`, confirmText: 'Devolver' })
    if (!ok) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selected)) {
        try { await devolverEncomenda(id) } catch (e) { console.warn(e) }
      }
      setSelected(new Set())
      await reload()
    } finally {
      setBulkBusy(false)
    }
  }

  const rowsFiltradas = useMemo(() => {
    const de = dataDe ? new Date(dataDe + 'T00:00:00').getTime() : null
    const ate = dataAte ? new Date(dataAte + 'T23:59:59').getTime() : null
    if (de === null && ate === null) return rows
    return rows.filter((r) => {
      const t = new Date(r.created_at).getTime()
      if (de !== null && t < de) return false
      if (ate !== null && t > ate) return false
      return true
    })
  }, [rows, dataDe, dataAte])

  const rowsTab = useMemo(() => {
    if (tab === 'comida') return rowsFiltradas.filter((r) => r.tipo === 'comida')
    return rowsFiltradas.filter((r) => r.tipo !== 'comida')
  }, [rowsFiltradas, tab])

  const totaisAba = useMemo(() => ({
    encomendas: rowsFiltradas.filter((r) => r.tipo !== 'comida').length,
    comida: rowsFiltradas.filter((r) => r.tipo === 'comida').length,
  }), [rowsFiltradas])

  const kanbanColunas = useMemo(() => ({
    aguardando: rowsTab.filter((r) => r.status === 'aguardando'),
    entregue:   rowsTab.filter((r) => r.status === 'entregue'),
    devolvida:  rowsTab.filter((r) => r.status === 'devolvida'),
  }), [rowsTab])

  async function marcarEntregue(id: string, nome: string) {
    if (!perfil?.id) return
    try {
      await darBaixaEncomenda(id, nome || 'Morador', perfil.id)
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

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
      const data = await listEncomendas({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
      })
      setRows(data)
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

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
  }

  const canRegister = perfil && ['admin_onway', 'administradora', 'sindico', 'portaria'].includes(perfil.role)
  const canSeeStats = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria'].includes(perfil.role)
  const aguardando = rows.filter((r) => r.status === 'aguardando').length

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <PageHeader
        title={isMorador ? 'Minhas encomendas' : `Encomendas${aguardando > 0 ? ` (${aguardando} aguardando)` : ''}`}
        subtitle={
          isMorador
            ? 'Encomendas que chegaram pra você ou pra sua unidade.'
            : 'Pacotes, comida e documentos recebidos na portaria.'
        }
        actions={
          (canRegister || canSeeStats) && (
            <div className="flex items-center flex-wrap gap-2">
              {canRegister && (
                <>
                  <Link to="/encomendas/novo?tipo=encomenda">
                    <Button>📦 Pacote</Button>
                  </Link>
                  <Link to="/encomendas/novo?tipo=comida">
                    <Button variant="secondary">🍔 Comida</Button>
                  </Link>
                  <Link to="/encomendas/novo?tipo=documento">
                    <Button variant="secondary">📄 Documento</Button>
                  </Link>
                  <Link to="/encomendas/novo?tipo=outro">
                    <Button variant="secondary">📬 Outro</Button>
                  </Link>
                </>
              )}
              {canSeeStats && (
                <Link to="/encomendas/estatisticas">
                  <Button variant="secondary">📊 Estatísticas</Button>
                </Link>
              )}
            </div>
          )
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
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">De</label>
          <input ref={dataDeRef} type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} onClick={() => dataDeRef.current?.showPicker?.()} className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Até</label>
          <input ref={dataAteRef} type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} onClick={() => dataAteRef.current?.showPicker?.()} className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm" />
        </div>
        {(dataDe || dataAte) && (
          <Button size="sm" variant="ghost" onClick={() => { setDataDe(''); setDataAte('') }}>Limpar datas</Button>
        )}
      </div>

      {podeBulk && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-sm text-amber-200">{selected.size} selecionada(s)</span>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="sm" onClick={devolverSelecionadas} disabled={bulkBusy}>
            {bulkBusy ? 'Devolvendo...' : `↩ Devolver ${selected.size}`}
          </Button>
        </div>
      )}

      {/* Tabs Encomendas / Comida */}
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(k) => setTab(k as 'encomendas' | 'comida')}
        tabs={[
          { key: 'encomendas', label: 'Encomendas', icon: '📦', count: totaisAba.encomendas },
          { key: 'comida', label: 'Comidas', icon: '🍔', count: totaisAba.comida },
        ]}
      />

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <CardListSkeleton rows={5} />
      ) : tab === 'encomendas' ? (
        <KanbanEncomendas
          colunas={kanbanColunas}
          unidadeLabel={unidadeLabel}
          onCard={(id) => navigate(`/encomendas/${id}`)}
          onEntregar={marcarEntregue}
          selected={podeBulk ? selected : null}
          onToggle={toggleSelected}
        />
      ) : (
        <ListaComidas
          rows={rowsTab}
          unidadeLabel={unidadeLabel}
          onCard={(id) => navigate(`/encomendas/${id}`)}
          onEntregar={marcarEntregue}
          selected={podeBulk ? selected : null}
          onToggle={toggleSelected}
        />
      )}
    </div>
  )
}

// ============================================================
// Kanban (encomendas não-comida)
// ============================================================
interface KanbanProps {
  colunas: Record<StatusEncomenda, Encomenda[]>
  unidadeLabel: (uid: string) => string
  onCard: (id: string) => void
  onEntregar: (id: string, nome: string) => void
  selected: Set<string> | null
  onToggle: (id: string) => void
}

const COLUNA_INFO: Record<StatusEncomenda, { label: string; emoji: string; accent: string }> = {
  aguardando: { label: 'Aguardando retirada', emoji: '⏳', accent: 'border-amber-500/40 bg-amber-500/5' },
  entregue:   { label: 'Entregues',           emoji: '✓',  accent: 'border-emerald-500/30 bg-emerald-500/5' },
  devolvida:  { label: 'Devolvidas',          emoji: '↩',  accent: 'border-slate-700 bg-slate-900/40' },
}

function KanbanEncomendas({ colunas, unidadeLabel, onCard, onEntregar, selected, onToggle }: KanbanProps) {
  const order: StatusEncomenda[] = ['aguardando', 'entregue', 'devolvida']
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {order.map((st) => {
        const info = COLUNA_INFO[st]
        const items = colunas[st]
        return (
          <div key={st} className={`rounded-lg border ${info.accent} p-3`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">
                <span className="mr-1.5">{info.emoji}</span>{info.label}
              </div>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-6">vazio</div>
            ) : (
              <div className="space-y-2">
                {items.map((e) => {
                  const diasParado = Math.floor((Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24))
                  const urgente = st === 'aguardando' && diasParado >= 7
                  return (
                    <div
                      key={e.id}
                      onClick={() => onCard(e.id)}
                      className={`rounded-md border bg-slate-950/60 p-3 cursor-pointer hover:border-slate-600 transition ${urgente ? 'border-red-500/60' : 'border-slate-800'}`}
                    >
                      <div className="flex items-start gap-2">
                        {selected && st === 'aguardando' && (
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(e.id)}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={() => onToggle(e.id)}
                            aria-label="Selecionar encomenda"
                          />
                        )}
                        <div className="text-xl shrink-0 leading-none">{TIPO_ICON[e.tipo]}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500 uppercase">{TIPO_LABEL[e.tipo]}</div>
                          <div className="text-sm font-medium text-slate-100">un. {unidadeLabel(e.unidade_id)}</div>
                          {e.descricao && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{e.descricao}</p>
                          )}
                          <div className="mt-1 text-[10px] text-slate-500">
                            {st === 'aguardando' && (
                              <span className={urgente ? 'text-red-400 font-semibold' : ''}>
                                há {diasParado === 0 ? 'hoje' : `${diasParado}d`}
                              </span>
                            )}
                            {st === 'entregue' && e.entregue_em && (
                              <span>{new Date(e.entregue_em).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {st === 'aguardando' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(ev) => { ev.stopPropagation(); onEntregar(e.id, '') }}
                          className="mt-2 w-full"
                        >
                          ✓ Marcar entregue
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Lista de comidas (cronológica, com destaque pra urgentes)
// ============================================================
interface ListaComidasProps {
  rows: Encomenda[]
  unidadeLabel: (uid: string) => string
  onCard: (id: string) => void
  onEntregar: (id: string, nome: string) => void
  selected: Set<string> | null
  onToggle: (id: string) => void
}

function ListaComidas({ rows, unidadeLabel, onCard, onEntregar, selected, onToggle }: ListaComidasProps) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Nenhuma entrega de comida agora." />
    )
  }
  return (
    <div className="space-y-2">
      {rows.map((e) => {
        const minutos = Math.floor((Date.now() - new Date(e.created_at).getTime()) / 60000)
        const aguardando = e.status === 'aguardando'
        const urgente = aguardando && minutos >= 15
        return (
          <div
            key={e.id}
            onClick={() => onCard(e.id)}
            className={`rounded-lg border p-4 cursor-pointer transition flex items-center gap-3 ${
              urgente
                ? 'border-red-500/60 bg-red-500/5 hover:border-red-500'
                : aguardando
                  ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
            }`}
          >
            {selected && aguardando && (
              <input
                type="checkbox"
                className="mr-1"
                checked={selected.has(e.id)}
                onClick={(ev) => ev.stopPropagation()}
                onChange={() => onToggle(e.id)}
                aria-label="Selecionar comida"
              />
            )}
            <div className="text-3xl shrink-0 leading-none">🍔</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-100">un. {unidadeLabel(e.unidade_id)}</span>
                {urgente && <span className="text-xs text-red-400 font-semibold">▲ {minutos}min aguardando</span>}
                {aguardando && !urgente && <span className="text-xs text-amber-400">há {minutos}min</span>}
                {!aguardando && (
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_CLASS[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                )}
              </div>
              {e.descricao && (
                <p className="text-xs text-slate-300 mt-0.5">{e.descricao}</p>
              )}
            </div>
            {aguardando && (
              <Button
                type="button"
                size="sm"
                onClick={(ev) => { ev.stopPropagation(); onEntregar(e.id, '') }}
                className="shrink-0"
              >
                ✓ Entregue
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

