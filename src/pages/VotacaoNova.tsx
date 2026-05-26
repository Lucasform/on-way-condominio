import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createVotacao } from '../lib/votacoes'
import { listCondominios } from '../lib/condominios'
import type { VotacaoInput } from '../types/votacao'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: VotacaoInput = {
  condominio_id: '',
  titulo: '',
  descricao: null,
  data_inicio: new Date().toISOString().slice(0, 16), // datetime-local format
  data_fim: null,
  opcoes: ['Sim', 'Não'],
}

export default function VotacaoNova() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<VotacaoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil])

  function setOpcao(i: number, v: string) {
    setForm((f) => ({ ...f, opcoes: f.opcoes.map((o, idx) => (idx === i ? v : o)) }))
  }
  function addOpcao() {
    setForm((f) => ({ ...f, opcoes: [...f.opcoes, ''] }))
  }
  function removeOpcao(i: number) {
    setForm((f) => ({ ...f, opcoes: f.opcoes.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.titulo.trim()) return setError('Título obrigatório.')
    const opcoesValidas = form.opcoes.map((o) => o.trim()).filter(Boolean)
    if (opcoesValidas.length < 2) return setError('Pelo menos 2 opções de voto.')

    setSubmitting(true)
    setError(null)
    try {
      const created = await createVotacao({
        ...form,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        opcoes: opcoesValidas,
      })
      navigate(`/votacoes/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <PageHeader
        title="Nova votação"
        actions={
          <Link to="/votacoes">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {isAdmin && (
          <Field label="Condomínio" required>
            <Select
              required
              value={form.condominio_id}
              onChange={(e) => setForm({ ...form, condominio_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Pergunta" required>
          <TextInput
            required
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: Aprovar reforma da fachada?"
          />
        </Field>

        <Field label="Descrição (contexto)">
          <TextArea
            rows={3}
            value={form.descricao ?? ''}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Início" required>
            <TextInput
              type="datetime-local"
              required
              value={form.data_inicio}
              onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            />
          </Field>
          <Field label="Fim (opcional)">
            <TextInput
              type="datetime-local"
              value={form.data_fim ?? ''}
              onChange={(e) => setForm({ ...form, data_fim: e.target.value || null })}
            />
          </Field>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Opções de voto</label>
          <div className="space-y-2">
            {form.opcoes.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <TextInput
                  value={opt}
                  onChange={(e) => setOpcao(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                />
                {form.opcoes.length > 2 && (
                  <Button type="button" variant="ghost" onClick={() => removeOpcao(i)}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addOpcao}>
              + Adicionar opção
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar votação'}
          </Button>
          <Link to="/votacoes">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
