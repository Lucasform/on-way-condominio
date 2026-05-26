import { useEffect, useMemo, useState } from 'react'
import { listAudit, type AuditEntry } from '../lib/auditLog'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select, TextInput, Field } from '../components/ui/Input'

const ACOES = [
  { v: '', l: 'Todas' },
  { v: 'pessoa.convidada', l: 'Pessoa convidada' },
  { v: 'pessoa.desativada', l: 'Pessoa desativada' },
  { v: 'pessoa.reativada', l: 'Pessoa reativada' },
  { v: 'usuario.reset_senha_solicitado', l: 'Reset de senha' },
  { v: 'convite.resgatado', l: 'Convite resgatado' },
  { v: 'lgpd.exclusao_solicitada', l: 'LGPD exclusão' },
]

export default function AuditLog() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [acao, setAcao] = useState('')
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')

  const [rows, setRows] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => setCondos(cs))
        .catch(() => {})
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    }
  }, [isAdmin, perfil])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listAudit({
        condominio_id: scopeId || undefined,
        acao: acao || undefined,
        desde: desde ? new Date(desde).toISOString() : undefined,
        ate: ate ? new Date(ate + 'T23:59:59').toISOString() : undefined,
        limit: 300,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, acao, desde, ate])

  const totaisPorAcao = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.acao] = (m[r.acao] ?? 0) + 1
    return m
  }, [rows])

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <PageHeader
        title="Log de auditoria"
        subtitle={`Últimas ${rows.length} ações sensíveis registradas.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        {isAdmin && (
          <Field label="Condomínio">
            <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              <option value="">Todos</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Ação">
          <Select value={acao} onChange={(e) => setAcao(e.target.value)}>
            {ACOES.map((a) => (
              <option key={a.v} value={a.v}>{a.l}</option>
            ))}
          </Select>
        </Field>
        <Field label="De">
          <TextInput type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Até">
          <TextInput type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Field>
      </div>

      {Object.keys(totaisPorAcao).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(totaisPorAcao).map(([a, n]) => (
            <span key={a} className="px-2 py-1 rounded text-xs bg-brand-700/10 text-brand-700 dark:text-brand-300 border border-brand-700/20">
              {a}: <strong>{n}</strong>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="text-left px-3 py-2">Quando</th>
              <th className="text-left px-3 py-2">Ator</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Ação</th>
              <th className="text-left px-3 py-2">Alvo</th>
              <th className="text-left px-3 py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && (
              <tr><td colSpan={6} className="text-center py-6 text-slate-500">Carregando...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-slate-500">Nada registrado nesse filtro.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtTs(r.created_at)}</td>
                <td className="px-3 py-2 text-xs">{r.ator_email ?? '—'}</td>
                <td className="px-3 py-2 text-xs"><span className="capitalize">{r.ator_role ?? '—'}</span></td>
                <td className="px-3 py-2 font-mono text-xs text-brand-700 dark:text-brand-400">{r.acao}</td>
                <td className="px-3 py-2 text-xs">{r.alvo_tipo}{r.alvo_id ? ` · ${r.alvo_id.slice(0, 8)}…` : ''}</td>
                <td className="px-3 py-2 text-xs text-slate-500 max-w-md truncate" title={JSON.stringify(r.detalhes)}>
                  {fmtDetalhes(r.detalhes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button variant="secondary" onClick={reload}>Atualizar</Button>
      </div>
    </div>
  )
}

function fmtTs(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR') } catch { return iso }
}

function fmtDetalhes(d: Record<string, unknown>): string {
  if (!d || Object.keys(d).length === 0) return '—'
  return Object.entries(d)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ')
}
