import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  listEmailLogs,
  deleteEmailLog,
  deleteEmailLogs,
  sendEmail,
  type EmailLog,
} from '../lib/email'
import { listCondominios } from '../lib/condominios'
import { listPessoas } from '../lib/pessoas'
import { listUnidades } from '../lib/unidades'
import { supabase } from '../lib/supabase'
import type { Condominio } from '../types/condominio'
import type { Pessoa } from '../types/pessoa'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'
import TemplatePicker from '../components/TemplatePicker'
import { TableSkeleton } from '../components/ui/Skeleton'

const STATUS_CLASS = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  sent: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/30',
}

type DestinoTipo = 'pessoa' | 'unidade' | 'todos'

interface ComposeState {
  destinoTipo: DestinoTipo
  pessoa: Pessoa | null
  unidadeId: string
  assunto: string
  corpo: string
}

const EMPTY_COMPOSE: ComposeState = {
  destinoTipo: 'pessoa',
  pessoa: null,
  unidadeId: '',
  assunto: '',
  corpo: '',
}

export default function EmailsLog() {
  const { user, perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const podeCompor =
    perfil?.role === 'admin_onway'
    || perfil?.role === 'sindico'
    || perfil?.role === 'subsindico'
    || perfil?.role === 'administradora'

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

  // Escopo efetivo: admin geral usa scopeId, demais usam o condominio_id do perfil
  const condominioAtivo = isAdmin ? scopeId : perfil?.condominio_id ?? null

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listEmailLogs({ condominio_id: condominioAtivo ?? undefined })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, isAdmin])

  // admin geral + sindico/subsindico podem apagar
  const podeApagar = perfil?.role === 'admin_onway' || perfil?.role === 'sindico' || perfil?.role === 'subsindico'
  const [busy, setBusy] = useState(false)

  async function apagar(id: string) {
    const ok = await confirm({
      title: 'Apagar registro',
      message: 'Apagar este registro do log? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteEmailLog(id)
      await reload()
      toast.success('Registro apagado.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  async function apagarTodos() {
    if (rows.length === 0) return
    const ok = await confirm({
      title: 'Apagar todos visíveis',
      message: `Apagar TODOS os ${rows.length} registros visíveis? Esta ação não pode ser desfeita.`,
      tone: 'danger',
      confirmText: 'Apagar todos',
    })
    if (!ok) return
    setBusy(true)
    try {
      const apagados = await deleteEmailLogs(rows.map((r) => r.id))
      await reload()
      toast.success(`${apagados} registro${apagados !== 1 ? 's' : ''} apagado${apagados !== 1 ? 's' : ''}.`)
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  const totals = {
    sent: rows.filter((r) => r.status === 'sent').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  }

  // -----------------------------------------------------------------
  // Compose
  // -----------------------------------------------------------------
  const [showCompose, setShowCompose] = useState(false)
  const [form, setForm] = useState<ComposeState>(EMPTY_COMPOSE)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [enviando, setEnviando] = useState(false)
  const [polindo, setPolindo] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [buscaPessoa, setBuscaPessoa] = useState('')
  const [comboAberto, setComboAberto] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showCompose || !condominioAtivo) return
    Promise.all([
      listPessoas({ condominio_id: condominioAtivo, ativo: true }),
      listUnidades({ condominio_id: condominioAtivo, ativo: true }),
    ])
      .then(([ps, us]) => {
        setPessoas(ps.filter((p) => !!p.email))
        setUnidades(us)
      })
      .catch(() => {})
  }, [showCompose, condominioAtivo])

  useEffect(() => {
    if (!comboAberto) return
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [comboAberto])

  const pessoasFiltradas = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase()
    if (!q) return pessoas
    return pessoas.filter((p) =>
      p.nome.toLowerCase().includes(q)
      || (p.email ?? '').toLowerCase().includes(q),
    )
  }, [pessoas, buscaPessoa])

  function update<K extends keyof ComposeState>(key: K, value: ComposeState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function resetCompose() {
    setForm(EMPTY_COMPOSE)
    setBuscaPessoa('')
    setComposeError(null)
    setShowCompose(false)
  }

  async function destinatariosFinais(): Promise<string[]> {
    if (!condominioAtivo) return []
    if (form.destinoTipo === 'pessoa') {
      if (!form.pessoa?.email) return []
      return [form.pessoa.email]
    }
    if (form.destinoTipo === 'unidade') {
      if (!form.unidadeId) return []
      const { data } = await supabase
        .from('pessoas')
        .select('email')
        .eq('condominio_id', condominioAtivo)
        .eq('unidade_id', form.unidadeId)
        .eq('ativo', true)
        .not('email', 'is', null)
      const emails = (data ?? []).map((r) => r.email as string).filter(Boolean)
      return Array.from(new Set(emails))
    }
    // todos
    const { data } = await supabase
      .from('pessoas')
      .select('email')
      .eq('condominio_id', condominioAtivo)
      .eq('ativo', true)
      .not('email', 'is', null)
    const emails = (data ?? []).map((r) => r.email as string).filter(Boolean)
    return Array.from(new Set(emails))
  }

  async function melhorarComAgente() {
    if (!form.corpo.trim()) {
      setComposeError('Escreva um esboço antes de chamar o Agente.')
      return
    }
    setPolindo(true)
    setComposeError(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('improve-template', {
        body: {
          tipo: 'email',
          titulo: form.assunto || 'E-mail',
          corpo: form.corpo,
          assunto: form.assunto,
          condominio_id: condominioAtivo ?? undefined,
        },
      })
      if (e) throw e
      if (data?.error) throw new Error(data.error)
      if (typeof data?.corpo === 'string') update('corpo', data.corpo)
      if (typeof data?.assunto === 'string' && data.assunto) update('assunto', data.assunto)
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Erro ao melhorar com o Agente.')
    } finally {
      setPolindo(false)
    }
  }

  async function handleEnviar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!condominioAtivo) {
      setComposeError('Selecione um condomínio.')
      return
    }
    if (!form.assunto.trim()) { setComposeError('Assunto é obrigatório.'); return }
    if (!form.corpo.trim()) { setComposeError('Corpo é obrigatório.'); return }

    setComposeError(null)
    setEnviando(true)
    try {
      const destinatarios = await destinatariosFinais()
      if (destinatarios.length === 0) {
        setComposeError('Nenhum destinatário com e-mail cadastrado.')
        return
      }
      if (form.destinoTipo === 'todos' && destinatarios.length > 1) {
        if (!window.confirm(`Enviar pra ${destinatarios.length} morador${destinatarios.length === 1 ? '' : 'es'}?`)) {
          return
        }
      }
      const corpoHtml = form.corpo
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')
      const res = await sendEmail({
        to: destinatarios,
        template: 'custom',
        condominio_id: condominioAtivo,
        custom: {
          subject: form.assunto.trim(),
          html: corpoHtml,
          text: form.corpo,
        },
        vars: {
          sender_name: perfil?.nome_exibicao ?? null,
        },
      })
      const msg = `Enviado: ${res.ok}/${res.total}.` + (res.fail > 0 ? ` ${res.fail} falharam.` : '')
      alert(msg)
      resetCompose()
      await reload()
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Controle de e-mails"
        subtitle="Histórico e envio manual de e-mails."
        actions={
          <div className="flex flex-wrap gap-2">
            {podeCompor && !showCompose && (
              <Button onClick={() => setShowCompose(true)}>+ Novo e-mail</Button>
            )}
            {podeApagar && rows.length > 0 && (
              <Button variant="danger" onClick={apagarTodos} disabled={busy}>
                Apagar todos visíveis
              </Button>
            )}
          </div>
        }
      />

      {/* Compose */}
      {showCompose && (
        <form
          onSubmit={handleEnviar}
          className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5 space-y-4"
        >
          <div className="text-sm font-medium text-sky-200">Enviar e-mail</div>

          <Field label="Destino">
            <div className="flex flex-wrap gap-2">
              {(['pessoa', 'unidade', 'todos'] as DestinoTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('destinoTipo', t)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition ${
                    form.destinoTipo === t
                      ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                      : 'border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {t === 'pessoa' ? 'Pessoa específica' : t === 'unidade' ? 'Unidade' : 'Todos os moradores'}
                </button>
              ))}
            </div>
          </Field>

          {form.destinoTipo === 'pessoa' && (
            <Field label={`Pessoa (${pessoas.length} com e-mail)`}>
              <div ref={comboRef} className="relative">
                <input
                  type="text"
                  value={form.pessoa && !comboAberto ? `${form.pessoa.nome} — ${form.pessoa.email}` : buscaPessoa}
                  onChange={(e) => {
                    setBuscaPessoa(e.target.value)
                    setComboAberto(true)
                    if (form.pessoa) update('pessoa', null)
                  }}
                  onFocus={() => setComboAberto(true)}
                  placeholder="Digite o nome ou e-mail..."
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
                />
                {comboAberto && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                    {pessoasFiltradas.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500">Nenhum resultado.</div>
                    ) : (
                      pessoasFiltradas.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            update('pessoa', p)
                            setBuscaPessoa('')
                            setComboAberto(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-800 transition"
                        >
                          <div className="text-sm text-slate-100 truncate">{p.nome}</div>
                          <div className="text-[11px] text-slate-500 truncate">{p.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}

          {form.destinoTipo === 'unidade' && (
            <Field label="Unidade">
              <Select value={form.unidadeId} onChange={(e) => update('unidadeId', e.target.value)}>
                <option value="">Selecione...</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
                  </option>
                ))}
              </Select>
              <div className="mt-1 text-xs text-slate-500">
                E-mail vai pra todos os moradores ativos cadastrados nessa unidade.
              </div>
            </Field>
          )}

          {form.destinoTipo === 'todos' && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              ⚠ Vai disparar pra TODOS os moradores ativos do condomínio que tenham e-mail cadastrado.
            </div>
          )}

          <Field label="Assunto" required>
            <TextInput
              required
              value={form.assunto}
              onChange={(e) => update('assunto', e.target.value)}
              placeholder="Assunto do e-mail"
            />
          </Field>

          <Field label="Corpo" required>
            <TextArea
              required
              rows={8}
              value={form.corpo}
              onChange={(e) => update('corpo', e.target.value)}
              placeholder="Texto do e-mail. Use quebras de linha pra separar parágrafos."
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {condominioAtivo && (
                <TemplatePicker
                  condominio_id={condominioAtivo}
                  tipo="email"
                  onSelect={(t) => {
                    if (t.assunto) update('assunto', t.assunto)
                    update('corpo', t.corpo)
                  }}
                />
              )}
              <button
                type="button"
                onClick={melhorarComAgente}
                disabled={polindo || !form.corpo.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-violet-700/20 text-violet-200 border border-violet-500/40 hover:bg-violet-700/30 disabled:opacity-50 transition"
              >
                {polindo ? '✨ Pensando...' : '✨ Melhorar com o Agente'}
              </button>
            </div>
          </Field>

          {composeError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {composeError}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetCompose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

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
        <TableSkeleton rows={6} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhum e-mail enviado ainda." />
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
                {podeApagar && <th className="px-4 py-3"></th>}
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
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.template_slug ?? '-'}</td>
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
                  {podeApagar && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => apagar(r.id)}
                        disabled={busy}
                        className="text-slate-500 hover:text-red-400 transition disabled:opacity-50"
                        title="Apagar este registro"
                      >
                        🗑
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Status atualizado no momento do envio.
      </p>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

