import { useEffect, useMemo, useState } from 'react'
import { listAudit, deleteAuditEntries, type AuditEntry } from '../lib/auditLog'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
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
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const podeApagar = perfil?.role === 'admin_onway'
  const [busy, setBusy] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())

  function toggleSelecao(id: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function toggleSelecionarTodos() {
    const visiveisIds = rowsFiltradas.map((r) => r.id)
    const todosVisiveisSelecionados = visiveisIds.every((id) => selecionados.has(id))
    if (todosVisiveisSelecionados) {
      setSelecionados((prev) => {
        const next = new Set(prev)
        for (const id of visiveisIds) next.delete(id)
        return next
      })
    } else {
      setSelecionados((prev) => {
        const next = new Set(prev)
        for (const id of visiveisIds) next.add(id)
        return next
      })
    }
  }

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [acao, setAcao] = useState('')
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')
  const [buscaAtor, setBuscaAtor] = useState('')

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

  const rowsFiltradas = useMemo(() => {
    if (!buscaAtor.trim()) return rows
    const q = buscaAtor.toLowerCase()
    return rows.filter((r) =>
      (r.ator_email ?? '').toLowerCase().includes(q) ||
      (r.ator_role ?? '').toLowerCase().includes(q) ||
      (r.ator_id ?? '').toLowerCase().includes(q),
    )
  }, [rows, buscaAtor])

  const totaisPorAcao = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rowsFiltradas) m[r.acao] = (m[r.acao] ?? 0) + 1
    return m
  }, [rowsFiltradas])

  function exportarCSV() {
    const header = ['quando', 'ator_email', 'ator_role', 'ator_id', 'acao', 'alvo_tipo', 'alvo_id', 'detalhes']
    const linhas = rowsFiltradas.map((r) => [
      r.created_at,
      r.ator_email ?? '',
      r.ator_role ?? '',
      r.ator_id ?? '',
      r.acao,
      r.alvo_tipo ?? '',
      r.alvo_id ?? '',
      JSON.stringify(r.detalhes ?? {}),
    ])
    const csv = [header, ...linhas]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-7xl mx-auto">
      <PageHeader
        title="Log de auditoria"
        subtitle={`${rowsFiltradas.length} de ${rows.length} ações sensíveis ${buscaAtor ? '(filtrado por ator)' : 'registradas'}.`}
        actions={
          podeApagar && selecionados.size > 0 ? (
            <Button variant="danger" disabled={busy} onClick={async () => {
              const ids = Array.from(selecionados)
              const ok = await confirm({
                title: 'Apagar registros',
                message: `Apagar ${ids.length} registro${ids.length !== 1 ? 's' : ''} selecionado${ids.length !== 1 ? 's' : ''}? Esta ação não pode ser desfeita.`,
                tone: 'danger',
                confirmText: 'Apagar',
              })
              if (!ok) return
              setBusy(true)
              try {
                const n = await deleteAuditEntries(ids)
                setSelecionados(new Set())
                await reload()
                toast.success(`${n} registro${n !== 1 ? 's' : ''} apagado${n !== 1 ? 's' : ''}.`)
              } catch (e) {
                toast.error('Erro', e instanceof Error ? e.message : '')
              } finally {
                setBusy(false)
              }
            }}>
              🗑 Apagar {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
            </Button>
          ) : undefined
        }
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
          <TextInput
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </Field>
        <Field label="Até">
          <TextInput
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[240px]">
          <Field label="Buscar por ator" hint="Nome, e-mail, role ou ID do usuário">
            <TextInput
              type="search"
              value={buscaAtor}
              onChange={(e) => setBuscaAtor(e.target.value)}
              placeholder="Ex: lucas@... ou sindico"
            />
          </Field>
        </div>
        <Button variant="secondary" onClick={exportarCSV} disabled={rowsFiltradas.length === 0}>
          ⬇ Exportar CSV
        </Button>
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
              {podeApagar && (
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={rowsFiltradas.length > 0 && rowsFiltradas.every((r) => selecionados.has(r.id))}
                    onChange={toggleSelecionarTodos}
                    className="rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
                    title="Selecionar todos visíveis"
                  />
                </th>
              )}
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
              <tr><td colSpan={podeApagar ? 7 : 6} className="text-center py-6 text-slate-500">Carregando...</td></tr>
            )}
            {!loading && rowsFiltradas.length === 0 && (
              <tr><td colSpan={podeApagar ? 7 : 6} className="text-center py-6 text-slate-500">Nada registrado nesse filtro.</td></tr>
            )}
            {rowsFiltradas.map((r) => {
              const checked = selecionados.has(r.id)
              return (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 ${
                    checked ? 'bg-brand-500/5 dark:bg-brand-700/10' : ''
                  }`}
                >
                  {podeApagar && (
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelecao(r.id)}
                        className="rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtTs(r.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{r.ator_email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs"><span className="capitalize">{r.ator_role ?? '—'}</span></td>
                  <td className="px-3 py-2 font-mono text-xs text-brand-700 dark:text-brand-400">{r.acao}</td>
                  <td className="px-3 py-2 text-xs">{r.alvo_tipo}{r.alvo_id ? ` · ${r.alvo_id.slice(0, 8)}…` : ''}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-md truncate" title={JSON.stringify(r.detalhes)}>
                    {fmtDetalhes(r.detalhes)}
                  </td>
                </tr>
              )
            })}
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
