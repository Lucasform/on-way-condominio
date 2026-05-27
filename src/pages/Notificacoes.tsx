import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listNotificacoes, NOTIFICACAO_STATUS_LABEL } from '../lib/notificacoes'
import { listUnidades } from '../lib/unidades'
import type { Notificacao, StatusNotificacao } from '../types/notificacao'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'

const STATUS_CLASS: Record<StatusNotificacao, string> = {
  pendente:  'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  enviada:   'bg-sky-500/10 text-sky-300 border border-sky-500/30',
  ciente:    'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  arquivada: 'bg-slate-700/40 text-slate-400',
  cancelada: 'bg-slate-700/40 text-slate-500',
}

export default function Notificacoes() {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows] = useState<Notificacao[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [status, setStatus] = useState<'' | StatusNotificacao>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listNotificacoes({ status: status || undefined })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    listUnidades().then(setUnidades).catch(() => {})
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
  }

  const podeCriar = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const columns: Column<Notificacao>[] = [
    {
      key: 'assunto',
      header: 'Assunto',
      render: (r) => <span className="font-medium text-slate-100">{r.assunto}</span>,
    },
    { key: 'unidade', header: 'Unidade', render: (r) => unidadeLabel(r.unidade_id) },
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
  ]

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        title="Notificações"
        subtitle="Advertências formais sem valor financeiro. Tipicamente usadas antes de aplicar uma multa."
        actions={
          podeCriar ? (
            <Link to="/notificacoes/nova">
              <Button>+ Nova notificação</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 max-w-xs">
        <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por status</label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as '' | StatusNotificacao)}>
          <option value="">Todos os status</option>
          {Object.entries(NOTIFICACAO_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => navigate(`/notificacoes/${r.id}`)}
        emptyMessage="Nenhuma notificação."
      />
    </div>
  )
}
