import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listChamados, updateChamadoStatus } from '../lib/chamados'
import { listCondominios } from '../lib/condominios'
import { supabase } from '../lib/supabase'
import type { Chamado, StatusChamado, PrioridadeChamado, CategoriaChamado } from '../types/chamado'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Fab from '../components/ui/Fab'
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

const CATEGORIAS: CategoriaChamado[] = [
  'eletrica', 'hidraulica', 'jardim', 'limpeza', 'seguranca', 'elevador', 'estrutural', 'outro',
]

// Status em que o chamado conta como "aberto" pra fins de SLA.
const STATUS_ABERTOS: StatusChamado[] = ['aberto', 'em_andamento', 'aguardando']

function diasAberto(c: Chamado): number {
  return Math.floor((Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000))
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
  const [prioFilter, setPrioFilter] = useState<'' | PrioridadeChamado>('')
  const [catFilter, setCatFilter] = useState<'' | CategoriaChamado>('')
  const [busca, setBusca] = useState('')
  const [soMeus, setSoMeus] = useState(false)
  const [assigneeNomes, setAssigneeNomes] = useState<Record<string, string>>({})

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

  // Resolve nomes dos responsáveis presentes nas linhas
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.atribuido_para).filter((id): id is string => !!id && !assigneeNomes[id])))
    if (ids.length === 0) return
    supabase
      .from('perfis')
      .select('id, nome_exibicao')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        setAssigneeNomes((prev) => {
          const novo = { ...prev }
          for (const p of data) novo[p.id] = p.nome_exibicao ?? 'Staff'
          return novo
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const filteredRows = useMemo(() => {
    const de = dataDe ? new Date(dataDe + 'T00:00:00').getTime() : null
    const ate = dataAte ? new Date(dataAte + 'T23:59:59').getTime() : null
    const q = busca.trim().toLowerCase()
    return rows.filter((r) => {
      const t = new Date(r.created_at).getTime()
      if (de !== null && t < de) return false
      if (ate !== null && t > ate) return false
      if (prioFilter && r.prioridade !== prioFilter) return false
      if (catFilter && r.categoria !== catFilter) return false
      if (soMeus && r.atribuido_para !== perfil?.id) return false
      if (q && !(r.titulo.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, dataDe, dataAte, prioFilter, catFilter, soMeus, busca, perfil?.id])

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
      {podeAbrir && <Fab to="/chamados/novo" label="Novo chamado" />}

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
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Prioridade</label>
          <Select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value as '' | PrioridadeChamado)}>
            <option value="">Todas</option>
            <option value="urgente">🚨 Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Categoria</label>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value as '' | CategoriaChamado)}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Buscar</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Título ou descrição..."
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {podeAbrir && (
          <label className="flex items-center gap-2 text-sm text-slate-300 pb-2 cursor-pointer">
            <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} />
            Só os meus
          </label>
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
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2 items-center">
                    <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                    {c.atribuido_para && (
                      <span className="text-violet-300">👤 {assigneeNomes[c.atribuido_para] ?? '...'}</span>
                    )}
                    {STATUS_ABERTOS.includes(c.status) && diasAberto(c) >= 3 && (
                      <span className={diasAberto(c) >= 7 ? 'text-red-300 font-medium' : 'text-amber-300'}>
                        ⏱ aberto há {diasAberto(c)}d
                      </span>
                    )}
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
