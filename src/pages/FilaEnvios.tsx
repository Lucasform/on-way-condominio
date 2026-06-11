import { useEffect, useMemo, useState } from 'react'
import {
  listEnvioFila,
  reenviarEnvio,
  reenviarFalhos,
  destinoEnvio,
  motivoEnvio,
  type EnvioFila,
  type StatusEnvio,
  type CanalEnvio,
} from '../lib/envioFila'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { TableSkeleton } from '../components/ui/Skeleton'

const STATUS_LABEL: Record<StatusEnvio, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
}
const STATUS_CLASS: Record<StatusEnvio, string> = {
  pendente: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  enviado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  falhou: 'bg-red-500/10 text-red-300 border-red-500/30',
  cancelado: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

function proximaLabel(e: EnvioFila): string {
  if (e.status !== 'pendente') return '—'
  const diff = new Date(e.proxima_em).getTime() - Date.now()
  if (diff <= 0) return 'agora'
  const min = Math.round(diff / 60000)
  return min < 60 ? `em ${min} min` : `em ${Math.round(min / 60)} h`
}

export default function FilaEnvios() {
  const { perfil } = useAuth()
  const toast = useToast()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [canal, setCanal] = useState<'' | CanalEnvio>('')
  const [status, setStatus] = useState<'' | StatusEnvio>('')
  const [rows, setRows] = useState<EnvioFila[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then((cs) => {
        setCondos(cs)
        if (cs.length && !scopeId) setScopeId(cs[0].id)
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function reload() {
    setLoading(true)
    try {
      const data = await listEnvioFila({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        canal: canal || undefined,
        status: status || undefined,
      })
      setRows(data)
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, canal, status])

  async function handleReenviar(id: string) {
    setBusy(true)
    try {
      await reenviarEnvio(id)
      toast.success('Reenvio disparado.')
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  const falhosIds = useMemo(() => rows.filter((r) => r.status === 'falhou').map((r) => r.id), [rows])

  async function handleReenviarTodos() {
    if (falhosIds.length === 0) return
    setBusy(true)
    try {
      await reenviarFalhos(falhosIds)
      toast.success(`${falhosIds.length} reenvio(s) disparado(s).`)
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <PageHeader
        title="Fila de envios"
        subtitle="Avisos que falharam e estão sendo reprocessados. Reenvie manualmente se precisar."
        actions={
          falhosIds.length > 0 ? (
            <Button onClick={handleReenviarTodos} disabled={busy}>
              ↻ Reenviar falhados ({falhosIds.length})
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>
        )}
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Canal</label>
          <Select value={canal} onChange={(e) => setCanal(e.target.value as '' | CanalEnvio)}>
            <option value="">Todos</option>
            <option value="email">E-mail</option>
            <option value="whatsapp">WhatsApp</option>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | StatusEnvio)}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="falhou">Falhou</option>
            <option value="enviado">Enviado</option>
          </Select>
        </div>
        <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>Atualizar</Button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState message="Nada na fila. Todos os avisos saíram normalmente. 👍" />
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Canal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Para</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Tent.</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Motivo / próxima</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3 whitespace-nowrap">{e.canal === 'email' ? '✉️ E-mail' : '🟢 WhatsApp'}</td>
                  <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">{destinoEnvio(e)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{e.tentativas}/{e.max_tentativas}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {e.status === 'enviado' ? (
                      <span className="text-emerald-400">entregue</span>
                    ) : (
                      <>
                        <div>{motivoEnvio(e)}</div>
                        {e.status === 'pendente' && (
                          <div className="text-[11px] text-slate-500">próxima tentativa {proximaLabel(e)}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.status !== 'enviado' && e.status !== 'cancelado' && (
                      <Button size="sm" variant="secondary" onClick={() => handleReenviar(e.id)} disabled={busy}>
                        Reenviar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
