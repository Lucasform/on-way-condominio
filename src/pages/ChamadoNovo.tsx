import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createChamado } from '../lib/chamados'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { ChamadoInput, CategoriaChamado, PrioridadeChamado } from '../types/chamado'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: ChamadoInput = {
  condominio_id: '',
  unidade_id: null,
  titulo: '',
  descricao: '',
  categoria: 'outro',
  prioridade: 'media',
}

export default function ChamadoNovo() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<ChamadoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil])

  useEffect(() => {
    if (!form.condominio_id) return setUnidades([])
    listUnidades({ condominio_id: form.condominio_id, ativo: true }).then(setUnidades).catch(() => {})
  }, [form.condominio_id])

  function update<K extends keyof ChamadoInput>(key: K, value: ChamadoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.titulo.trim() || !form.descricao.trim()) return setError('Título e descrição obrigatórios.')

    setSubmitting(true)
    setError(null)
    try {
      await createChamado(form, user.id)
      navigate('/chamados')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao abrir chamado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <PageHeader
        title="Abrir chamado"
        subtitle="Solicite manutenção. A equipe será notificada."
        actions={
          <Link to="/chamados">
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
              onChange={(e) => {
                update('condominio_id', e.target.value)
                update('unidade_id', null)
              }}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Unidade (opcional)" hint="Se o problema é específico de uma unidade.">
          <Select
            value={form.unidade_id ?? ''}
            onChange={(e) => update('unidade_id', e.target.value || null)}
            disabled={!form.condominio_id}
          >
            <option value="">Área comum / sem unidade específica</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Título" required>
          <TextInput
            required
            value={form.titulo}
            onChange={(e) => update('titulo', e.target.value)}
            placeholder='Ex: "Vazamento na garagem G1"'
          />
        </Field>

        <Field label="Descrição" required>
          <TextArea
            required
            rows={4}
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria" required>
            <Select
              value={form.categoria}
              onChange={(e) => update('categoria', e.target.value as CategoriaChamado)}
            >
              <option value="eletrica">Elétrica</option>
              <option value="hidraulica">Hidráulica</option>
              <option value="jardim">Jardim</option>
              <option value="limpeza">Limpeza</option>
              <option value="seguranca">Segurança</option>
              <option value="elevador">Elevador</option>
              <option value="estrutural">Estrutural</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Prioridade" required>
            <Select
              value={form.prioridade}
              onChange={(e) => update('prioridade', e.target.value as PrioridadeChamado)}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">🚨 Urgente</option>
            </Select>
          </Field>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Abrindo...' : 'Abrir chamado'}
          </Button>
          <Link to="/chamados">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
