import { useEffect, useState } from 'react'
import { listEmailLogs, type EmailLog } from '../lib/email'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'

const STATUS_CLASS = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  sent: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export default function EmailsLog() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway'
  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    if (isAdmin && !scopeId) return
    setLoading(true)
    listEmailLogs({ condominio_id: isAdmin && scopeId ? scopeId : undefined })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro.'))
      .finally(() => setLoading(false))
  }, [scopeId, isAdmin])

  const totals = {
    sent: rows.filter((r) => r.status === 'sent').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  }

  return (
    <div className="px-8 py-10 max-w-6xl">
      <PageHeader
        title="Log de e-mails"
        subtitle="Histórico de e-mails enviados via Resend (status, destinatário, template)."
      />

      <div className="mb-4 grid grid-cols-3 gap-3 max-w-xl">
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-xs text-emerald-300">Enviados</div>
          <div className="text-xl font-bold text-slate-100">{totals.sent}</div>
        </div>
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-xs text-amber-300">Pendentes</div>
          <div className="text-xl font-bold text-slate-100">{totals.pending}</div>
        </div>
        <div className="rounded border border-red-500/30 bg-red-500/5 p-3">
          <div className="text-xs text-red-300">Falhas</div>
          <div className="text-xl font-bold text-slate-100">{totals.failed}</div>
        </div>
      </div>

      {isAdmin && condos.length > 0 && (
        <div className="mb-5 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhum e-mail enviado ainda.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase">Para</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase">Assunto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase">Template</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800/60 hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-200 truncate max-w-[220px]">{r.para}</td>
                  <td className="px-4 py-3 text-slate-200 truncate max-w-[280px]">{r.assunto}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.template_slug ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[r.status]}`}>
                      {r.status}
                    </span>
                    {r.erro && (
                      <div className="text-[10px] text-red-400 mt-1 truncate max-w-[200px]" title={r.erro}>
                        {r.erro}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Envios feitos via Resend ({rows[0]?.condominio_id ? 'condomínio' : 'sistema'}). Log local
        + ID retornado pelo Resend. Status atualizado em tempo da chamada.
      </p>
    </div>
  )
}
