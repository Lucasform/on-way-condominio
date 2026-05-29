import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../components/AuthProvider'
import {
  createListaNegra,
  deleteListaNegra,
  listListaNegra,
  setListaNegraAtivo,
} from '../lib/listaNegra'
import { isGestor, isStaff } from '../lib/permissions'
import type { ListaNegraInput, ListaNegraItem } from '../types/listaNegra'
import type { DocumentoTipo } from '../types/acesso'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: ListaNegraInput = {
  condominio_id: '',
  nome: '',
  documento_tipo: null,
  documento_numero: null,
  motivo: null,
}

export default function ListaNegraPage() {
  const { perfil } = useAuth()
  const staff = isStaff(perfil?.role)
  const gestor = isGestor(perfil?.role)

  const [rows, setRows] = useState<ListaNegraItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ListaNegraInput>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function load() {
    if (!perfil?.condominio_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listListaNegra(perfil.condominio_id)
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

  if (!staff) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader title="Lista de bloqueio" />
        <div className="text-sm text-slate-500 italic">Apenas a administração do condomínio acessa esta área.</div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) return setError('Informe o nome.')
    setWorking(true)
    try {
      await createListaNegra(form)
      setForm({ ...EMPTY, condominio_id: form.condominio_id })
      setShowForm(false)
      await load()
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
    } finally {
      setWorking(false)
    }
  }

  async function handleToggle(r: ListaNegraItem) {
    setWorking(true)
    try {
      await setListaNegraAtivo(r.id, !r.ativo)
      await load()
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete(r: ListaNegraItem) {
    if (!window.confirm(`Apagar ${r.nome} da lista DEFINITIVAMENTE?`)) return
    setWorking(true)
    try {
      await deleteListaNegra(r.id)
      await load()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Lista de bloqueio"
        subtitle="Pessoas barradas de entrar no condomínio. Vale pra qualquer unidade que tente autorizar."
        actions={
          gestor && (
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Fechar' : '+ Adicionar'}
            </Button>
          )
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5"
        >
          <Field label="Nome" required>
            <TextInput
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
            <Field label="Documento">
              <Select
                value={form.documento_tipo ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    documento_tipo: (e.target.value || null) as DocumentoTipo | null,
                  })
                }
              >
                <option value="">—</option>
                <option value="cpf">CPF</option>
                <option value="rg">RG</option>
                <option value="cnh">CNH</option>
                <option value="passaporte">Passaporte</option>
                <option value="outro">Outro</option>
              </Select>
            </Field>
            <Field label="Número">
              <TextInput
                value={form.documento_numero ?? ''}
                onChange={(e) => setForm({ ...form, documento_numero: e.target.value || null })}
                placeholder="opcional"
              />
            </Field>
          </div>
          <Field label="Motivo">
            <TextArea
              value={form.motivo ?? ''}
              onChange={(e) => setForm({ ...form, motivo: e.target.value || null })}
              rows={3}
              placeholder="Por que está sendo barrada (auditoria interna)."
            />
          </Field>
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={working}>
              {working ? 'Salvando...' : 'Adicionar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading && <div className="text-slate-400 text-sm">Carregando...</div>}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-slate-500 italic rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          Nenhuma pessoa barrada.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.ativo ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-900/40 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{r.nome}</div>
                  {r.documento_numero && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      {(r.documento_tipo ?? 'doc').toUpperCase()} {r.documento_numero}
                    </div>
                  )}
                  {r.motivo && <div className="text-xs text-slate-300 mt-1 italic">{r.motivo}</div>}
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-xs border ${
                    r.ativo
                      ? 'bg-red-500/15 text-red-300 border-red-500/40'
                      : 'bg-slate-700/40 text-slate-400 border-slate-700'
                  }`}
                >
                  {r.ativo ? 'Ativo' : 'Pausado'}
                </span>
              </div>
              {gestor && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/60">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(r)} disabled={working}>
                    {r.ativo ? '⏸ Pausar' : '▶ Reativar'}
                  </Button>
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
