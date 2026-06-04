import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listChamados, updateChamadoStatus } from '../lib/chamados'
import { listCondominios } from '../lib/condominios'
import type { Chamado, StatusChamado, PrioridadeChamado } from '../types/chamado'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { CardListSkeleton } from '../components/ui/Skeleton'

const STATUS_OPTS: { value: '' | StatusChamado; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'resolvido', label: 'Resolvidos' },
  { value: 'finalizado', label: 'Finalizados' },
  { value: 'cancelado', label: 'Cancelados' },
]

const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

const STATUS_CLASS: Record<StatusChamado, string> = {
  aberto: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_andamento: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  resolvido: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  finalizado: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  cancelado: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

const PRIO_CLASS: Record<PrioridadeChamado, string> = {
  baixa: 'text-slate-400',
  media: 'text-amber-300',
  alta: 'text-orange-300',
  urgente: 'text-red-300 font-bold',
}

const PRIO_LABEL: Record<PrioridadeChamado, string> = {
  baixa: 'baixa',
  media: 'média',
  alta: 'alta',
  urgente: '🚨 urgente',
}

export default function Chamados() {
  const { perfil } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusChamado>('')
  const [rows, setRows] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const dataDeRef = useRef<HTMLInputElement>(null)
  const dataAteRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  async function reload() {
    if (isAdmin && !scopeId) return
    setLoading(true)
    try {
      const data = await listChamados({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        status: statusFilter || undefined,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
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
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, statusFilter, isAdmin])

  const podeAbrir = perfil?.role !== 'morador'
  const podeBulk = perfil?.role !== 'morador'

  const filteredRows = useMemo(() => {
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

  const arquivaveis = filteredRows.filter((c) => c.status !== 'cancelado' && c.status !== 'finalizado').map((c) => c.id)
  const todosSelecionados = arquivaveis.length > 0 && arquivaveis.every((id) => selected.has(id))
  function toggleSelected(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  async function arquivarSelecionados() {
    if (selected.size === 0) return
    const ok = await confirm({ message: `Cancelar ${selected.size} chamado(s)?`, tone: 'danger', confirmText: 'Cancelar' })
    if (!ok) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selected)) {
        try { await updateChamadoStatus(id, 'cancelado') } catch (e) { console.warn(e) }
      }
      setSelected(new Set())
      await reload()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <PageHeader
        title="Chamados de manutenção"
        actions={
          podeAbrir ? (
            <Link to="/chamados/novo">
              <Button>+ Novo chamado</Button>
            </Link>
          ) : undefined
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
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusChamado)}
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
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

      {podeBulk && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {arquivaveis.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setSelected(todosSelecionados ? new Set() : new Set(arquivaveis))}>
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar visíveis'}
            </Button>
          )}
          {selected.size > 0 && (
            <>
              <span className="text-sm text-amber-200">{selected.size} selecionado(s)</span>
              <Button size="sm" onClick={arquivarSelecionados} disabled={bulkBusy}>
                {bulkBusy ? 'Cancelando...' : `Cancelar ${selected.size}`}
              </Button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <CardListSkeleton rows={5} />
      ) : filteredRows.length === 0 ? (
        <EmptyState message="Nenhum chamado encontrado." />
      ) : (
        <div className="space-y-2">
          {filteredRows.map((c) => (
            <article
              key={c.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT') return
                navigate(`/chamados/${c.id}`)
              }}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 cursor-pointer hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start gap-3">
                {podeBulk && (
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    disabled={c.status === 'cancelado' || c.status === 'finalizado'}
                    onChange={() => toggleSelected(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Selecionar"
                    className="mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-100">{c.titulo}</span>
                    <span className={`text-xs ${PRIO_CLASS[c.prioridade]}`}>· {PRIO_LABEL[c.prioridade]}</span>
                    <span className="text-xs text-slate-500">· {c.categoria}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 line-clamp-2">{c.descricao}</p>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(c.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
