import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPet, deletePet, getPet, updatePet } from '../lib/pets'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import type { PetInput, EspeciePet, PortePet } from '../types/pet'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: PetInput = {
  condominio_id: '',
  unidade_id: '',
  pessoa_id: null,
  nome: '',
  especie: 'cao',
  raca: null,
  porte: null,
  foto_url: null,
  vacinacao_em_dia: false,
  data_vacina_antirabica: null,
  observacoes: null,
}

export default function PetForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canDelete = !isNew && isGestor(perfil?.role)

  const [form, setForm] = useState<PetInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!id) return
    const ok = await confirm({
      title: 'Excluir pet',
      message: `Excluir o pet ${form.nome || ''} DEFINITIVAMENTE?`,
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deletePet(id)
      toast.success('Pet excluído.')
      navigate('/pets')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.')
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id && isNew) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil, isNew])

  useEffect(() => {
    if (!form.condominio_id) {
      setUnidades([])
      setPessoas([])
      return
    }
    listUnidades({ condominio_id: form.condominio_id, ativo: true }).then(setUnidades).catch(() => {})
    listPessoas({ condominio_id: form.condominio_id, ativo: true }).then(setPessoas).catch(() => {})
  }, [form.condominio_id])

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const p = await getPet(id!)
        if (!mounted) return
        if (!p) setError('Pet não encontrado.')
        else {
          setForm({
            condominio_id: p.condominio_id,
            unidade_id: p.unidade_id,
            pessoa_id: p.pessoa_id,
            nome: p.nome,
            especie: p.especie,
            raca: p.raca,
            porte: p.porte,
            foto_url: p.foto_url,
            vacinacao_em_dia: p.vacinacao_em_dia,
            data_vacina_antirabica: p.data_vacina_antirabica,
            observacoes: p.observacoes,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, isNew])

  function update<K extends keyof PetInput>(key: K, value: PetInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.unidade_id) return setError('Selecione a unidade.')
    setSaving(true)
    setError(null)
    try {
      if (isNew) await createPet(form)
      else await updatePet(id!, form)
      navigate('/pets')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title={isNew ? 'Novo pet' : 'Editar pet'}
        actions={
          <div className="flex items-center gap-2">
            {canDelete && <DeleteButton onClick={handleDelete} disabled={deleting} />}
            <Link to="/pets">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
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
                update('unidade_id', '')
                update('pessoa_id', null)
              }}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Unidade" required>
          <Select
            required
            value={form.unidade_id}
            onChange={(e) => update('unidade_id', e.target.value)}
            disabled={!form.condominio_id}
          >
            <option value="">Selecione...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tutor (opcional)">
          <Select
            value={form.pessoa_id ?? ''}
            onChange={(e) => update('pessoa_id', e.target.value || null)}
            disabled={!form.condominio_id}
          >
            <option value="">—</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </Field>

        <Field label="Nome" required>
          <TextInput
            required
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Espécie" required>
            <Select
              value={form.especie}
              onChange={(e) => update('especie', e.target.value as EspeciePet)}
            >
              <option value="cao">Cão</option>
              <option value="gato">Gato</option>
              <option value="ave">Ave</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Raça">
            <TextInput
              value={form.raca ?? ''}
              onChange={(e) => update('raca', e.target.value)}
            />
          </Field>
          <Field label="Porte">
            <Select
              value={form.porte ?? ''}
              onChange={(e) => update('porte', (e.target.value || null) as PortePet)}
            >
              <option value="">—</option>
              <option value="pequeno">Pequeno</option>
              <option value="medio">Médio</option>
              <option value="grande">Grande</option>
            </Select>
          </Field>
        </div>

        <Field label="Foto (URL)">
          <TextInput
            value={form.foto_url ?? ''}
            onChange={(e) => update('foto_url', e.target.value)}
            placeholder="https://..."
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.vacinacao_em_dia}
            onChange={(e) => update('vacinacao_em_dia', e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
          />
          Vacinação em dia
        </label>

        <Field label="Data da próxima antirrábica" hint="Lembrete automático 30 dias antes do vencimento.">
          <TextInput
            type="date"
            value={form.data_vacina_antirabica ?? ''}
            onChange={(e) => update('data_vacina_antirabica', e.target.value || null)}
            onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </Field>

        <Field label="Observações">
          <TextArea
            value={form.observacoes ?? ''}
            onChange={(e) => update('observacoes', e.target.value)}
            placeholder="Alérgico a X, agressivo com estranhos, etc."
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </Button>
          <Link to="/pets">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
