import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listMultas, MULTA_STATUS_LABEL } from '../lib/multas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Multa, StatusMulta } from '../types/multa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'

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

export default function Multas() {
  const { perfil } = useAuth()
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
    if (!u) return '—'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const total = rows.reduce((sum, m) => sum + Number(m.valor), 0)

  return (
    <div className="px-8 py-10 max-w-5xl">
      <PageHeader
        title={isMorador ? 'Minhas multas' : `Multas${rows.length > 0 ? ` (${rows.length})` : ''}`}
        subtitle={
          isMorador
            ? 'Multas vinculadas ao seu cadastro.'
            : 'Decisões registradas; sem cobrança financeira no app.'
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
        {rows.length > 0 && !isMorador && (
          <div className="ml-auto text-sm text-slate-400">
            Soma: <span className="text-slate-100 font-semibold">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
      </div>

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
          Nenhuma multa encontrada.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Unidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-right px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-slate-800/60 cursor-pointer hover:bg-slate-800/40"
                  onClick={() => navigate(`/multas/${m.id}`)}
                >
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
