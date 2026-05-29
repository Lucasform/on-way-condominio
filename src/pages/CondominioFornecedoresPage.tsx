import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../components/AuthProvider'
import {
  aprovarFornecedor,
  createFornecedor,
  deleteFornecedor,
  inativarFornecedor,
  listFornecedores,
  recusarFornecedor,
} from '../lib/condominioFornecedores'
import { isStaff, isGestor } from '../lib/permissions'
import type {
  CondominioFornecedor,
  CondominioFornecedorInput,
  FornecedorAgenda,
  StatusFornecedor,
  TipoFornecedor,
} from '../types/condominioFornecedor'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const TIPO_LABEL: Record<TipoFornecedor, string> = {
  prestador: '🛠 Prestador',
  diarista: '🧹 Diarista',
  jardineiro: '🌿 Jardineiro',
  manutencao: '🔧 Manutenção',
  pintor: '🎨 Pintor',
  eletricista: '⚡ Eletricista',
  encanador: '🔩 Encanador',
  feirante: '🥬 Feirante',
  entregador: '🛵 Entregador',
  outro: '📌 Outro',
}

const STATUS_LABEL: Record<StatusFornecedor, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  inativo: 'Inativo',
  recusado: 'Recusado',
}

const STATUS_CLASS: Record<StatusFornecedor, string> = {
  pendente: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  aprovado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  inativo: 'bg-slate-700/40 text-slate-400 border-slate-700',
  recusado: 'bg-red-500/10 text-red-300 border-red-500/30',
}

const DIAS = [
  { v: 'seg', l: 'Seg' },
  { v: 'ter', l: 'Ter' },
  { v: 'qua', l: 'Qua' },
  { v: 'qui', l: 'Qui' },
  { v: 'sex', l: 'Sex' },
  { v: 'sab', l: 'Sáb' },
  { v: 'dom', l: 'Dom' },
]

type Aba = 'aprovados' | 'pendentes' | 'feira' | 'meus'

const EMPTY: CondominioFornecedorInput = {
  condominio_id: '',
  nome: '',
  tipo: 'prestador',
  servico: null,
  telefone: null,
  email: null,
  documento: null,
  agenda: null,
  observacoes: null,
}

export default function CondominioFornecedoresPage() {
  const { user, perfil } = useAuth()
  const staff = isStaff(perfil?.role)
  const gestor = isGestor(perfil?.role)

  const [aba, setAba] = useState<Aba>('aprovados')
  const [rows, setRows] = useState<CondominioFornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CondominioFornecedorInput>(EMPTY)
  const [dias, setDias] = useState<string[]>([])
  const [horario, setHorario] = useState('')
  const [ponto, setPonto] = useState('')

  async function load() {
    if (!perfil?.condominio_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listFornecedores({ condominio_id: perfil.condominio_id })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (perfil?.condominio_id) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.condominio_id])

  const filtered = useMemo(() => {
    if (aba === 'pendentes') return rows.filter((r) => r.status === 'pendente')
    if (aba === 'feira') return rows.filter((r) => r.tipo === 'feirante' && r.status === 'aprovado')
    if (aba === 'meus') return rows.filter((r) => r.cadastrado_por === user?.id)
    return rows.filter((r) => r.status === 'aprovado')
  }, [rows, aba, user])

  function toggleDia(v: string) {
    setDias((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.condominio_id) return setError('Condomínio não identificado.')
    if (!form.nome.trim()) return setError('Informe o nome.')
    setWorking(true)
    setError(null)
    try {
      const agenda: FornecedorAgenda | null =
        dias.length || horario || ponto
          ? {
              dias: dias.length ? dias : undefined,
              horario: horario || undefined,
              ponto: ponto || undefined,
            }
          : null
      await createFornecedor({ ...form, agenda }, user.id)
      setShowForm(false)
      setForm({ ...EMPTY, condominio_id: form.condominio_id })
      setDias([])
      setHorario('')
      setPonto('')
      await load()
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally {
      setWorking(false)
    }
  }

  async function handleAprovar(r: CondominioFornecedor) {
    if (!user) return
    setWorking(true)
    try {
      await aprovarFornecedor(r.id, user.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao aprovar.')
    } finally {
      setWorking(false)
    }
  }

  async function handleRecusar(r: CondominioFornecedor) {
    if (!user) return
    const motivo = window.prompt('Motivo da recusa (opcional):')
    if (motivo === null) return
    setWorking(true)
    try {
      await recusarFornecedor(r.id, user.id, motivo || undefined)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao recusar.')
    } finally {
      setWorking(false)
    }
  }

  async function handleInativar(r: CondominioFornecedor) {
    if (!window.confirm(`Inativar ${r.nome}?`)) return
    setWorking(true)
    try {
      await inativarFornecedor(r.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao inativar.')
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete(r: CondominioFornecedor) {
    if (!window.confirm(`Apagar ${r.nome} DEFINITIVAMENTE?`)) return
    setWorking(true)
    try {
      await deleteFornecedor(r.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setWorking(false)
    }
  }

  function fmtAgenda(a: FornecedorAgenda | null): string {
    if (!a) return ''
    const parts: string[] = []
    if (a.dias?.length) parts.push(a.dias.map((d) => d.toUpperCase()).join('/'))
    if (a.horario) parts.push(a.horario)
    if (a.ponto) parts.push(`(${a.ponto})`)
    return parts.join(' · ')
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-4xl mx-auto">
      <PageHeader
        title="Fornecedores do condomínio"
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Fechar' : '+ Cadastrar fornecedor'}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn ativo={aba === 'aprovados'} onClick={() => setAba('aprovados')}>
          Aprovados
        </TabBtn>
        <TabBtn ativo={aba === 'feira'} onClick={() => setAba('feira')}>
          🥬 Feira
        </TabBtn>
        {staff && (
          <TabBtn ativo={aba === 'pendentes'} onClick={() => setAba('pendentes')}>
            Pendentes
          </TabBtn>
        )}
        <TabBtn ativo={aba === 'meus'} onClick={() => setAba('meus')}>
          Meus cadastros
        </TabBtn>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5"
        >
          <Field label="Nome" required>
            <TextInput
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Dona Maria das Frutas"
            />
          </Field>
          <Field label="Tipo" required>
            <Select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoFornecedor })}
            >
              {(Object.keys(TIPO_LABEL) as TipoFornecedor[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Serviço prestado">
            <TextInput
              value={form.servico ?? ''}
              onChange={(e) => setForm({ ...form, servico: e.target.value || null })}
              placeholder="Ex.: vendas de frutas, banca da entrada"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone">
              <TextInput
                value={form.telefone ?? ''}
                onChange={(e) => setForm({ ...form, telefone: e.target.value || null })}
                placeholder="opcional"
              />
            </Field>
            <Field label="E-mail">
              <TextInput
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value || null })}
                placeholder="opcional"
              />
            </Field>
          </div>
          <Field label="Documento (CPF/CNPJ)">
            <TextInput
              value={form.documento ?? ''}
              onChange={(e) => setForm({ ...form, documento: e.target.value || null })}
              placeholder="opcional"
            />
          </Field>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3 space-y-3">
            <div className="text-sm font-medium text-slate-200">Quando atende</div>
            <div>
              <span className="block text-xs text-slate-400 mb-2">Dias da semana</span>
              <div className="flex flex-wrap gap-1">
                {DIAS.map((d) => (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDia(d.v)}
                    className={`px-3 py-1 text-xs rounded border ${
                      dias.includes(d.v)
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Horário">
              <TextInput
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                placeholder="08:00-12:00"
              />
            </Field>
            <Field label="Ponto interno" hint="Onde fica dentro do condomínio (vazio = na unidade)">
              <TextInput
                value={ponto}
                onChange={(e) => setPonto(e.target.value)}
                placeholder="Ex.: rua de feira, salão de festas..."
              />
            </Field>
          </div>

          <Field label="Observações">
            <TextArea
              value={form.observacoes ?? ''}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })}
              rows={2}
            />
          </Field>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="text-xs text-slate-400">
            O cadastro entra como <strong>pendente</strong>. A síndica ou portaria aprova antes
            de ficar visível pra todos os moradores.
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={working}>
              {working ? 'Enviando...' : 'Enviar cadastro'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading && <div className="text-slate-400 text-sm">Carregando...</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-sm text-slate-500 italic rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          Nada por aqui ainda.
        </div>
      )}

      {!loading && aba === 'feira' && filtered.length > 0 && (
        <FeiraCabecalho rows={filtered} />
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">
                    {TIPO_LABEL[r.tipo]} · {r.nome}
                  </div>
                  {r.servico && <div className="text-xs text-slate-300 mt-1">{r.servico}</div>}
                  <div className="text-xs text-slate-400 mt-1">
                    {r.telefone && <span>📞 {r.telefone} · </span>}
                    {r.agenda && <span>{fmtAgenda(r.agenda)}</span>}
                  </div>
                  {r.motivo_recusa && r.status === 'recusado' && (
                    <div className="text-xs text-red-300 mt-1 italic">Recusa: {r.motivo_recusa}</div>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {staff && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800">
                  {r.status === 'pendente' && (
                    <>
                      <Button onClick={() => handleAprovar(r)} disabled={working}>
                        ✓ Aprovar
                      </Button>
                      <Button variant="ghost" onClick={() => handleRecusar(r)} disabled={working}>
                        ✗ Recusar
                      </Button>
                    </>
                  )}
                  {r.status === 'aprovado' && (
                    <Button variant="ghost" onClick={() => handleInativar(r)} disabled={working}>
                      ⏸ Inativar
                    </Button>
                  )}
                  {gestor && <DeleteButton onClick={() => handleDelete(r)} disabled={working} />}
                </div>
              )}

              {!staff && r.cadastrado_por === user?.id && r.status === 'pendente' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                  <DeleteButton onClick={() => handleDelete(r)} disabled={working} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DIA_NOME: Record<string, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
}

function FeiraCabecalho({ rows }: { rows: CondominioFornecedor[] }) {
  // Agrega dias e horários únicos dos feirantes pra resumo no topo
  const diasSet = new Set<string>()
  const horarios = new Set<string>()
  const pontos = new Set<string>()
  for (const r of rows) {
    const a = r.agenda ?? {}
    a.dias?.forEach((d) => diasSet.add(d))
    if (a.horario) horarios.add(a.horario)
    if (a.ponto) pontos.add(a.ponto)
  }
  const dias = ['seg','ter','qua','qui','sex','sab','dom']
    .filter((d) => diasSet.has(d))
    .map((d) => DIA_NOME[d])
    .join(' · ')

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="text-sm font-medium text-amber-200">🥬 Feira do condomínio</div>
      <div className="text-xs text-slate-300 mt-1">
        {dias || 'Dias a definir'}
        {horarios.size > 0 && <> · {Array.from(horarios).join(' / ')}</>}
      </div>
      {pontos.size > 0 && (
        <div className="text-xs text-slate-400 mt-1">📍 {Array.from(pontos).join(' · ')}</div>
      )}
      <div className="text-xs text-slate-500 mt-2">
        {rows.length} {rows.length === 1 ? 'feirante cadastrado' : 'feirantes cadastrados'}.
      </div>
    </div>
  )
}

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded border ${
        ativo
          ? 'bg-brand-600 border-brand-600 text-white'
          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
      }`}
    >
      {children}
    </button>
  )
}
