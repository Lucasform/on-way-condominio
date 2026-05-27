import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'
import {
  createPrestador,
  createServico,
  deletePrestador,
  deleteServico,
  listPrestadores,
  listServicos,
  setPrestadorAtivo,
  updateServico,
} from '../lib/servicos'
import {
  CATEGORIA_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  type CategoriaServico,
  type Prestador,
  type Servico,
  type StatusServico,
} from '../types/servico'
import FornecedoresImport from '../components/FornecedoresImport'

type Tab = 'em_curso' | 'historico' | 'prestadores'

const CATEGORIAS: CategoriaServico[] = [
  'eletrica',
  'hidraulica',
  'jardim',
  'limpeza',
  'seguranca',
  'elevador',
  'estrutural',
  'outro',
]

const STATUSES: StatusServico[] = ['agendado', 'em_andamento', 'concluido', 'cancelado']

export default function Servicos() {
  const { perfil } = useAuth()
  const condominioId = perfil?.condominio_id ?? null
  const canManage = !!perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria'].includes(perfil.role)
  const canDelete = isGestor(perfil?.role)

  const [tab, setTab] = useState<Tab>('em_curso')
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showFormServico, setShowFormServico] = useState(false)
  const [showFormPrestador, setShowFormPrestador] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [ps, ss] = await Promise.all([
        listPrestadores({ condominio_id: condominioId ?? undefined }),
        listServicos({ condominio_id: condominioId ?? undefined }),
      ])
      setPrestadores(ps)
      setServicos(ss)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [condominioId])

  const servicosEmCurso = useMemo(
    () => servicos.filter((s) => s.status === 'agendado' || s.status === 'em_andamento'),
    [servicos],
  )
  const servicosHistorico = useMemo(
    () => servicos.filter((s) => s.status === 'concluido' || s.status === 'cancelado'),
    [servicos],
  )

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        title="Serviços"
        subtitle="Prestadores cadastrados e serviços executados no condomínio."
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowFormPrestador(true)}>
                + Novo prestador
              </Button>
              <Button onClick={() => setShowFormServico(true)}>
                + Adicionar serviço
              </Button>
            </div>
          )
        }
      />

      {/* Tabs */}
      <div className="mb-5 border-b border-slate-200 dark:border-slate-800 flex gap-1">
        <TabButton active={tab === 'em_curso'} onClick={() => setTab('em_curso')}>
          Em curso <span className="ml-1.5 text-xs text-slate-400">({servicosEmCurso.length})</span>
        </TabButton>
        <TabButton active={tab === 'prestadores'} onClick={() => setTab('prestadores')}>
          Prestadores <span className="ml-1.5 text-xs text-slate-400">({prestadores.length})</span>
        </TabButton>
        <TabButton active={tab === 'historico'} onClick={() => setTab('historico')}>
          Histórico <span className="ml-1.5 text-xs text-slate-400">({servicosHistorico.length})</span>
        </TabButton>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : tab === 'em_curso' ? (
        <ServicoList
          servicos={servicosEmCurso}
          prestadores={prestadores}
          empty="Nenhum serviço agendado ou em andamento."
          canManage={canManage}
          canDelete={canDelete}
          onChange={reload}
        />
      ) : tab === 'historico' ? (
        <ServicoList
          servicos={servicosHistorico}
          prestadores={prestadores}
          empty="Nenhum serviço finalizado ainda."
          canManage={canManage}
          canDelete={canDelete}
          onChange={reload}
        />
      ) : (
        <PrestadorList
          prestadores={prestadores}
          canManage={canManage}
          canDelete={canDelete}
          onChange={reload}
        />
      )}

      {showFormServico && condominioId && (
        <ServicoForm
          condominioId={condominioId}
          prestadores={prestadores}
          onClose={() => setShowFormServico(false)}
          onSaved={() => { setShowFormServico(false); reload() }}
        />
      )}

      {showFormPrestador && condominioId && (
        <PrestadorForm
          condominioId={condominioId}
          onClose={() => setShowFormPrestador(false)}
          onSaved={() => { setShowFormPrestador(false); reload() }}
        />
      )}

      {tab === 'prestadores' && isGestor(perfil?.role) && condominioId && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-slate-200 mb-1">Importar prestadores em massa</h2>
          <p className="text-xs text-slate-400 mb-4">
            Envie sua planilha em Excel ou CSV. Prestadores com nome já cadastrado são pulados.
          </p>
          <FornecedoresImport condominio_id={condominioId} />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Tab button
// ============================================================
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition ${
        active
          ? 'border-brand-600 text-brand-700 dark:text-brand-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================================
// Lista de serviços
// ============================================================
function ServicoList({
  servicos,
  prestadores,
  empty,
  canManage,
  canDelete,
  onChange,
}: {
  servicos: Servico[]
  prestadores: Prestador[]
  empty: string
  canManage: boolean
  canDelete: boolean
  onChange: () => void
}) {
  const prestadorNome = (id: string | null) =>
    id ? (prestadores.find((p) => p.id === id)?.nome ?? '—') : '—'

  if (servicos.length === 0) {
    return <div className="text-center text-sm text-slate-500 py-10">{empty}</div>
  }

  return (
    <div className="space-y-3">
      {servicos.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{s.titulo}</h3>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] border ${STATUS_CLASS[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {CATEGORIA_LABEL[s.categoria]} · {prestadorNome(s.prestador_id)}
                {s.valor != null && ` · R$ ${Number(s.valor).toFixed(2).replace('.', ',')}`}
              </div>
              {s.descricao && (
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{s.descricao}</p>
              )}
              {(s.data_inicio || s.data_fim) && (
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                  {s.data_inicio && `início: ${new Date(s.data_inicio).toLocaleString('pt-BR')}`}
                  {s.data_inicio && s.data_fim && ' · '}
                  {s.data_fim && `fim: ${new Date(s.data_fim).toLocaleString('pt-BR')}`}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canManage && (
                <StatusMenu
                  current={s.status}
                  onChange={async (novo) => {
                    if (!window.confirm(`Mudar status para "${STATUS_LABEL[novo]}"?`)) return
                    try { await updateServico(s.id, { status: novo }); onChange() }
                    catch (e) { alert(e instanceof Error ? e.message : 'Erro.') }
                  }}
                />
              )}
              {canDelete && (
                <DeleteButton
                  label=""
                  onClick={async () => {
                    if (!window.confirm('Excluir esse serviço DEFINITIVAMENTE?')) return
                    try { await deleteServico(s.id); onChange() }
                    catch (e) { alert(e instanceof Error ? e.message : 'Erro.') }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusMenu({ current, onChange }: { current: StatusServico; onChange: (s: StatusServico) => void }) {
  return (
    <select
      value={current}
      onChange={(e) => { const novo = e.target.value as StatusServico; if (novo !== current) onChange(novo) }}
      className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition"
      title="Mudar status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
  )
}

// ============================================================
// Lista de prestadores
// ============================================================
function PrestadorList({
  prestadores,
  canManage,
  canDelete,
  onChange,
}: {
  prestadores: Prestador[]
  canManage: boolean
  canDelete: boolean
  onChange: () => void
}) {
  if (prestadores.length === 0) {
    return <div className="text-center text-sm text-slate-500 py-10">Nenhum prestador cadastrado.</div>
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {prestadores.map((p) => (
        <div
          key={p.id}
          className={`rounded-lg border p-4 ${
            p.ativo
              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 opacity-70'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{p.nome}</h3>
                {!p.ativo && <span className="text-[10px] uppercase tracking-wide text-slate-400">Inativo</span>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{CATEGORIA_LABEL[p.categoria]}</div>
              <dl className="mt-2 space-y-0.5 text-xs">
                {p.telefone && <Info label="📞" value={p.telefone} />}
                {p.email && <Info label="✉" value={p.email} />}
                {p.documento && <Info label="📄" value={p.documento} />}
                {p.valor_referencia != null && (
                  <Info label="💰" value={`R$ ${Number(p.valor_referencia).toFixed(2).replace('.', ',')} (referência)`} />
                )}
              </dl>
              {p.observacoes && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{p.observacoes}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {canManage && (
                <button
                  onClick={async () => {
                    try { await setPrestadorAtivo(p.id, !p.ativo); onChange() }
                    catch (e) { alert(e instanceof Error ? e.message : 'Erro.') }
                  }}
                  className="text-[11px] text-slate-500 hover:text-brand-700 dark:hover:text-brand-400 transition"
                  title={p.ativo ? 'Desativar' : 'Reativar'}
                >
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
              )}
              {canDelete && (
                <DeleteButton
                  label=""
                  onClick={async () => {
                    if (!window.confirm(`Excluir o prestador "${p.nome}" DEFINITIVAMENTE? Serviços vinculados ficarão sem prestador.`)) return
                    try { await deletePrestador(p.id); onChange() }
                    catch (e) { alert(e instanceof Error ? e.message : 'Erro.') }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-slate-600 dark:text-slate-400">
      <span className="shrink-0">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}

// ============================================================
// Modal — Formulário de prestador
// ============================================================
function PrestadorForm({
  condominioId,
  onClose,
  onSaved,
}: {
  condominioId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    categoria: 'outro' as CategoriaServico,
    telefone: '',
    email: '',
    documento: '',
    valor_referencia: '',
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true)
    setErr(null)
    try {
      await createPrestador({
        condominio_id: condominioId,
        nome: form.nome,
        categoria: form.categoria,
        telefone: form.telefone || null,
        email: form.email || null,
        documento: form.documento || null,
        valor_referencia: form.valor_referencia ? Number(form.valor_referencia) : null,
        observacoes: form.observacoes || null,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo prestador" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" required>
          <TextInput required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Field>
        <Field label="Categoria" required>
          <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaServico })}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <TextInput value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF/CNPJ">
            <TextInput value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
          </Field>
          <Field label="Valor de referência (R$)">
            <TextInput
              type="number" step="0.01" min="0"
              value={form.valor_referencia}
              onChange={(e) => setForm({ ...form, valor_referencia: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Observações">
          <TextArea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </Field>
        {err && <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Modal — Formulário de serviço
// ============================================================
function ServicoForm({
  condominioId,
  prestadores,
  onClose,
  onSaved,
}: {
  condominioId: string
  prestadores: Prestador[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoria: 'outro' as CategoriaServico,
    status: 'em_andamento' as StatusServico,
    prestador_id: '',
    data_inicio: '',
    data_fim: '',
    valor: '',
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { setErr('Título é obrigatório.'); return }
    setSaving(true)
    setErr(null)
    try {
      await createServico({
        condominio_id: condominioId,
        prestador_id: form.prestador_id || null,
        titulo: form.titulo,
        descricao: form.descricao || null,
        categoria: form.categoria,
        status: form.status,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        valor: form.valor ? Number(form.valor) : null,
        observacoes: form.observacoes || null,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Adicionar serviço" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Título" required hint="Ex.: Manutenção do elevador social">
          <TextInput required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria" required>
            <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaServico })}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusServico })}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Prestador" hint="Opcional — pode cadastrar depois.">
          <Select value={form.prestador_id} onChange={(e) => setForm({ ...form, prestador_id: e.target.value })}>
            <option value="">— Sem prestador vinculado —</option>
            {prestadores.filter((p) => p.ativo).map((p) => (
              <option key={p.id} value={p.id}>{p.nome} ({CATEGORIA_LABEL[p.categoria]})</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <TextInput type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </Field>
          <Field label="Fim previsto">
            <TextInput type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </Field>
        </div>
        <Field label="Valor (R$)">
          <TextInput type="number" step="0.01" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <TextArea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </Field>
        <Field label="Observações internas">
          <TextArea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </Field>
        {err && <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Modal genérico
// ============================================================
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl my-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg"
            title="Fechar"
          >
            ✕
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
