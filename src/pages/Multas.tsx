import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listMultas, MULTA_STATUS_LABEL, changeMultaStatus } from '../lib/multas'
import { downloadCsv } from '../lib/csv'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Multa, StatusMulta } from '../types/multa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { TableSkeleton } from '../components/ui/Skeleton'

const STATUS_OPTS: { value: '' | StatusMulta; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'em_analise', label: MULTA_STATUS_LABEL.em_analise },
  { value: 'aplicada', label: MULTA_STATUS_LABEL.aplicada },
  { value: 'paga', label: MULTA_STATUS_LABEL.paga },
  { value: 'contestada', label: MULTA_STATUS_LABEL.contestada },
  { value: 'cancelada', label: MULTA_STATUS_LABEL.cancelada },
  { value: 'arquivada', label: MULTA_STATUS_LABEL.arquivada },
]

const STATUS_CLASS: Record<StatusMulta, string> = {
  em_analise: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  aplicada: 'bg-red-500/10 text-red-300 border-red-500/30',
  paga: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  contestada: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

// Aviso de vencimento na lista (só multas aplicadas com vencimento definido).
function vencInfo(m: Multa): { label: string; cls: string } | null {
  if (m.status !== 'aplicada' || !m.vencimento_em) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(m.vencimento_em + 'T00:00:00')
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000)
  if (dias < 0) return { label: `⏱ vencida há ${Math.abs(dias)}d`, cls: 'text-red-300 font-medium' }
  if (dias <= 3) return { label: `⏱ vence em ${dias}d`, cls: 'text-amber-300' }
  return null
}

export default function Multas() {
  const { perfil } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const isMorador = perfil?.role === 'morador'

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusMulta>('')
  const [rows, setRows] = useState<Multa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const dataDeRef = useRef<HTMLInputElement>(null)
  const dataAteRef = useRef<HTMLInputElement>(null)

  function setPreset(days: number | 'hoje' | 'mes') {
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const today = new Date()
    if (days === 'hoje') { setDataDe(fmt(today)); setDataAte(fmt(today)); return }
    if (days === 'mes') {
      setDataDe(fmt(new Date(today.getFullYear(), today.getMonth(), 1)))
      setDataAte(fmt(today)); return
    }
    const from = new Date(today); from.setDate(from.getDate() - days)
    setDataDe(fmt(from)); setDataAte(fmt(today))
  }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

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
      const data = await listMultas({
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
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, statusFilter])

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    if (!u) return '-'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const filteredRows = useMemo(() => {
    const de = dataDe ? new Date(dataDe + 'T00:00:00').getTime() : null
    const ate = dataAte ? new Date(dataAte + 'T23:59:59').getTime() : null
    if (de === null && ate === null) return rows
    return rows.filter((m) => {
      const t = new Date(m.created_at).getTime()
      if (de !== null && t < de) return false
      if (ate !== null && t > ate) return false
      return true
    })
  }, [rows, dataDe, dataAte])

  const total = filteredRows.reduce((sum, m) => sum + Number(m.valor), 0)

  const podeBulk = !isMorador
  const arquivaveis = filteredRows.filter((m) => m.status !== 'arquivada').map((m) => m.id)
  const todosSelecionados = arquivaveis.length > 0 && arquivaveis.every((id) => selected.has(id))

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }
  function toggleTodos() {
    if (todosSelecionados) {
      setSelected(new Set())
    } else {
      setSelected(new Set(arquivaveis))
    }
  }

  async function arquivarSelecionadas() {
    if (selected.size === 0) return
    const ok = await confirm({ message: `Arquivar ${selected.size} multa(s)?`, confirmText: 'Arquivar' })
    if (!ok) return
    setBulkBusy(true)
    try {
      const ids = Array.from(selected)
      for (const id of ids) {
        try { await changeMultaStatus(id, 'arquivada') } catch (e) { console.warn(e) }
      }
      setSelected(new Set())
      await reload()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={isMorador ? 'Minhas multas' : `Multas${rows.length > 0 ? ` (${rows.length})` : ''}`}
        subtitle={
          isMorador
            ? 'Multas vinculadas ao seu cadastro.'
            : 'Multas emitidas a partir de uma ocorrência. Sem cobrança financeira no app.'
        }
        actions={
          !isMorador ? (
            <Link to="/ocorrencias">
              <Button variant="secondary">Ir para ocorrências →</Button>
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
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusMulta)}
          >
            {STATUS_OPTS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">De</label>
          <input
            ref={dataDeRef}
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            onClick={() => dataDeRef.current?.showPicker?.()}
            className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Até</label>
          <input
            ref={dataAteRef}
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            onClick={() => dataAteRef.current?.showPicker?.()}
            className="px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1 items-end pb-0.5">
          {(['hoje', 7, 30, 'mes'] as const).map((p) => (
            <button
              key={String(p)}
              onClick={() => setPreset(p)}
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {p === 'hoje' ? 'Hoje' : p === 'mes' ? 'Este mês' : `${p}d`}
            </button>
          ))}
          {(dataDe || dataAte) && (
            <button onClick={() => { setDataDe(''); setDataAte('') }} className="px-2 py-1 text-xs rounded-md text-slate-500 hover:text-slate-300 transition-colors">✕</button>
          )}
        </div>
        {filteredRows.length > 0 && !isMorador && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">
              Soma: <span className="text-slate-100 font-semibold">R$ {total.toFixed(2).replace('.', ',')}</span>
            </span>
            <button
              onClick={() => downloadCsv(
                `multas-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Data', 'Unidade', 'Descrição', 'Valor', 'Status'],
                filteredRows.map((m) => [
                  new Date(m.created_at).toLocaleDateString('pt-BR'),
                  unidadeLabel(m.unidade_id),
                  m.descricao,
                  Number(m.valor).toFixed(2).replace('.', ','),
                  MULTA_STATUS_LABEL[m.status],
                ])
              )}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              ↓ CSV
            </button>
          </div>
        )}
      </div>

      {podeBulk && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-sm text-amber-200">{selected.size} selecionada(s)</span>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="sm" onClick={arquivarSelecionadas} disabled={bulkBusy}>
            {bulkBusy ? 'Arquivando...' : `Arquivar ${selected.size}`}
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon="📋"
          message="Nenhuma multa encontrada."
          hint={dataDe || dataAte || statusFilter ? 'Tente ajustar os filtros.' : 'Multas são geradas a partir de ocorrências.'}
          action={!isMorador ? <Link to="/ocorrencias"><Button size="sm" variant="secondary">Ver ocorrências →</Button></Link> : undefined}
        />
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                {podeBulk && (
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} aria-label="Selecionar todos" />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Unidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-right px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-slate-800/60 cursor-pointer hover:bg-slate-800/40"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName === 'INPUT') return
                    navigate(`/multas/${m.id}`)
                  }}
                >
                  {podeBulk && (
                    <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        disabled={m.status === 'arquivada'}
                        onChange={() => toggleSelected(m.id)}
                        aria-label={`Selecionar multa ${m.id}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{unidadeLabel(m.unidade_id)}</td>
                  <td className="px-4 py-3 text-slate-200 max-w-md truncate">{m.descricao}</td>
                  <td className="px-4 py-3 text-slate-100 font-medium text-right whitespace-nowrap">
                    R$ {Number(m.valor).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[m.status]}`}>
                      {MULTA_STATUS_LABEL[m.status]}
                    </span>
                    {(() => {
                      const v = vencInfo(m)
                      return v ? <div className={`mt-1 text-[11px] ${v.cls}`}>{v.label}</div> : null
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isMorador && (
        <p className="mt-4 text-xs text-slate-600">
          Para gerar uma nova multa, abra a <Link to="/ocorrencias" className="text-slate-400 hover:text-slate-200">ocorrência origem</Link>.
        </p>
      )}
    </div>
  )
}

