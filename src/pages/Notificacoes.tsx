import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listNotificacoes, NOTIFICACAO_STATUS_LABEL, changeNotificacaoStatus } from '../lib/notificacoes'
import { listUnidades } from '../lib/unidades'
import { listCondominios } from '../lib/condominios'
import type { Notificacao, StatusNotificacao } from '../types/notificacao'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'
import { downloadCsv } from '../lib/csv'

const STATUS_CLASS: Record<StatusNotificacao, string> = {
  pendente:     'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  enviada:      'bg-sky-500/10 text-sky-300 border border-sky-500/30',
  ciente:       'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  contestada:   'bg-orange-500/10 text-orange-300 border border-orange-500/30',
  advertencia:  'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30',
  multa_gerada: 'bg-red-500/10 text-red-300 border border-red-500/30',
  arquivada:    'bg-slate-700/40 text-slate-400',
  cancelada:    'bg-slate-700/40 text-slate-500',
}

export default function Notificacoes() {
  const { perfil } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [rows, setRows] = useState<Notificacao[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [status, setStatus] = useState<'' | StatusNotificacao>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const dataDeRef = useRef<HTMLInputElement>(null)
  const dataAteRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listNotificacoes({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        status: status || undefined,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    listCondominios()
      .then((cs) => {
        setCondos(cs)
        if (isAdmin && cs.length && !scopeId) setScopeId(cs[0].id)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    listUnidades({ condominio_id: isAdmin && scopeId ? scopeId : undefined })
      .then(setUnidades)
      .catch(() => {})
  }, [isAdmin, scopeId])

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scopeId])

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
  }

  const condoNome = (id: string) => condos.find((c) => c.id === id)?.nome ?? '-'

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

  const podeCriar = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)
  const podeBulk = podeCriar

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

  const arquivaveis = filteredRows.filter((r) => r.status !== 'arquivada' && r.status !== 'cancelada').map((r) => r.id)
  const todosSelecionados = arquivaveis.length > 0 && arquivaveis.every((id) => selected.has(id))
  function toggleSelected(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  async function arquivarSelecionadas() {
    if (selected.size === 0) return
    const ok = await confirm({ message: `Arquivar ${selected.size} notificação(ões)?`, confirmText: 'Arquivar' })
    if (!ok) return
    setBulkBusy(true)
    try {
      for (const id of Array.from(selected)) {
        try { await changeNotificacaoStatus(id, 'arquivada') } catch (e) { console.warn(e) }
      }
      setSelected(new Set())
      await reload()
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: Column<Notificacao>[] = [
    ...(podeBulk ? [{
      key: 'select',
      header: '',
      className: 'w-8',
      render: (r: Notificacao) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          disabled={r.status === 'arquivada' || r.status === 'cancelada'}
          onChange={() => toggleSelected(r.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Selecionar"
        />
      ),
    } as Column<Notificacao>] : []),
    {
      key: 'assunto',
      header: 'Assunto',
      render: (r) => <span className="font-medium text-slate-100">{r.assunto}</span>,
    },
    { key: 'unidade', header: 'Unidade', render: (r) => unidadeLabel(r.unidade_id) },
  ]
  if (isAdmin) {
    columns.push({ key: 'condo', header: 'Condomínio', render: (r) => condoNome(r.condominio_id) })
  }
  columns.push(
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CLASS[r.status]}`}>
          {NOTIFICACAO_STATUS_LABEL[r.status]}
        </span>
      ),
    },
    {
      key: 'data',
      header: 'Emitida em',
      render: (r) => new Date(r.created_at).toLocaleDateString('pt-BR'),
    },
  )

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Notificações"
        subtitle="Advertências formais emitidas a partir de uma ocorrência. Sem valor financeiro."
        actions={
          <div className="flex items-center gap-2">
            {filteredRows.length > 0 && (
              <button
                onClick={() => downloadCsv(
                  `notificacoes-${new Date().toISOString().slice(0, 10)}.csv`,
                  ['Data', 'Assunto', 'Unidade', 'Status'],
                  filteredRows.map((r) => [
                    new Date(r.created_at).toLocaleDateString('pt-BR'),
                    r.assunto,
                    unidadeLabel(r.unidade_id),
                    NOTIFICACAO_STATUS_LABEL[r.status],
                  ])
                )}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                ↓ CSV
              </button>
            )}
            {podeCriar && (
              <Link to="/ocorrencias">
                <Button variant="secondary">Ir para ocorrências →</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | StatusNotificacao)}>
            <option value="">Todos os status</option>
            {Object.entries(NOTIFICACAO_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
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
      </div>

      {podeBulk && (
        <div className="mb-3 flex items-center gap-2">
          {arquivaveis.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setSelected(todosSelecionados ? new Set() : new Set(arquivaveis))}>
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar visíveis'}
            </Button>
          )}
          {selected.size > 0 && (
            <>
              <span className="text-sm text-amber-200">{selected.size} selecionada(s)</span>
              <Button size="sm" onClick={arquivarSelecionadas} disabled={bulkBusy}>
                {bulkBusy ? 'Arquivando...' : `Arquivar ${selected.size}`}
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

      {!loading && filteredRows.length === 0 ? (
        <EmptyState
          icon="🔔"
          message="Nenhuma notificação encontrada."
          hint={dataDe || dataAte || status ? 'Tente ajustar os filtros.' : 'Notificações são geradas a partir de ocorrências.'}
          action={podeCriar ? <Link to="/ocorrencias"><Button size="sm" variant="secondary">Ver ocorrências →</Button></Link> : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => navigate(`/notificacoes/${r.id}`)}
          emptyMessage="Nenhuma notificação."
        />
      )}
    </div>
  )
}

