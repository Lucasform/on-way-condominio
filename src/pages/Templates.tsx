import { useEffect, useState, type FormEvent } from 'react'
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateAtivo,
  type MensagemTemplate,
  type TemplateTipo,
} from '../lib/templates'
import { supabase } from '../lib/supabase'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isGestor, isStaff } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

export default function Templates() {
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TemplateTipo>('chat')
  const [rows, setRows] = useState<MensagemTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // form (criar ou editar)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [saving, setSaving] = useState(false)
  const [polindo, setPolindo] = useState(false)

  const podeEditar = isStaff(perfil?.role)
  const podeApagar = isGestor(perfil?.role)

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

  const condoId = isAdmin && scopeId ? scopeId : perfil?.condominio_id ?? null

  async function reload() {
    if (!condoId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listTemplates({ condominio_id: condoId, tipo, apenas_ativos: false })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!condoId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condoId, tipo])

  function abrirNovo() {
    setEditId(null)
    setTitulo('')
    setAssunto('')
    setCorpo('')
    setShowForm(true)
  }

  function abrirEditar(t: MensagemTemplate) {
    setEditId(t.id)
    setTitulo(t.titulo)
    setAssunto(t.assunto ?? '')
    setCorpo(t.corpo)
    setShowForm(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!condoId) return
    if (!titulo.trim() || !corpo.trim()) {
      setError('Título e corpo são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        condominio_id: condoId,
        tipo,
        titulo: titulo.trim(),
        corpo: corpo.trim(),
        assunto: tipo === 'email' ? (assunto.trim() || null) : null,
      }
      if (editId) {
        await updateTemplate(editId, payload)
      } else {
        await createTemplate(payload, user?.id)
      }
      setShowForm(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function melhorarComAgente() {
    if (!corpo.trim()) {
      setError('Escreva um esboço antes de pedir ajuda do Agente.')
      return
    }
    setPolindo(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('improve-template', {
        body: {
          tipo,
          titulo: titulo.trim() || undefined,
          corpo: corpo.trim(),
          assunto: tipo === 'email' ? (assunto.trim() || undefined) : undefined,
          condominio_id: condoId,
        },
      })
      if (e) throw e
      if (data?.error) throw new Error(data.error)
      if (typeof data?.corpo === 'string') setCorpo(data.corpo)
      if (tipo === 'email' && typeof data?.assunto === 'string') setAssunto(data.assunto)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao melhorar com o Agente.')
    } finally {
      setPolindo(false)
    }
  }

  async function toggleAtivo(t: MensagemTemplate) {
    try {
      await setTemplateAtivo(t.id, !t.ativo)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function apagar(t: MensagemTemplate) {
    if (!window.confirm(`Apagar definitivamente o template "${t.titulo}"?`)) return
    try {
      await deleteTemplate(t.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        title="Templates de mensagem"
        subtitle="Modelos reutilizáveis pra chat e e-mail. Disponíveis pra portaria e demais perfis ao compor mensagem."
        actions={
          podeEditar && !showForm ? (
            <Button onClick={abrirNovo}>+ Novo template</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
          <div className="flex gap-1 rounded-md border border-slate-700 p-0.5 bg-slate-900">
            {(['chat', 'email'] as TemplateTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  tipo === t
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t === 'chat' ? '💬 Chat' : '📧 E-mail'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="mb-6 rounded-lg border border-brand-500/30 bg-brand-500/5 p-5 space-y-4">
          <div className="text-sm font-medium text-brand-200">
            {editId ? 'Editar template' : 'Novo template'} ({tipo === 'chat' ? 'chat' : 'e-mail'})
          </div>
          <Field label="Título (interno)" required>
            <TextInput value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Aviso de encomenda" required />
          </Field>
          {tipo === 'email' && (
            <Field label="Assunto do e-mail">
              <TextInput value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex: Encomenda na portaria" />
            </Field>
          )}
          <Field label="Conteúdo" required>
            <TextArea
              required
              rows={8}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Escreva o esboço. O Agente pode polir com emojis e estrutura quando você clicar abaixo. Use {nome}, {unidade}, {data} pra variáveis."
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={melhorarComAgente}
                disabled={polindo || !corpo.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-violet-700/20 text-violet-200 border border-violet-500/40 hover:bg-violet-700/30 disabled:opacity-50 transition"
              >
                {polindo ? '✨ Pensando...' : '✨ Melhorar com o Agente'}
              </button>
              <span className="text-[11px] text-slate-500">
                Reescreve mantendo o objetivo, aplica padrão{tipo === 'email' ? ' de e-mail' : ' de chat'} do condomínio.
              </span>
            </div>
          </Field>
          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {error && !showForm && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhum template ainda.
          {podeEditar && (
            <div className="mt-2">
              <button onClick={abrirNovo} className="text-brand-400 hover:underline">
                Criar o primeiro →
              </button>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id} className={`rounded-lg border ${t.ativo ? 'border-slate-800 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20 opacity-60'} p-4`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-100">{t.titulo}</h3>
                    {!t.ativo && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">inativo</span>
                    )}
                  </div>
                  {tipo === 'email' && t.assunto && (
                    <div className="text-xs text-slate-500 mb-1">Assunto: {t.assunto}</div>
                  )}
                  <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
                    {t.corpo}
                  </p>
                </div>
                {podeEditar && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" onClick={() => abrirEditar(t)}>Editar</Button>
                    <Button variant={t.ativo ? 'danger' : 'secondary'} onClick={() => toggleAtivo(t)}>
                      {t.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                    {podeApagar && (
                      <DeleteButton onClick={() => apagar(t)} />
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
