import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createUnidade, deleteUnidade, getUnidade, updateUnidade } from '../lib/unidades'
import { listCondominios } from '../lib/condominios'
import type { UnidadeInput, TipoUnidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, Select } from '../components/ui/Input'
import { traduzErro } from '../lib/errorMessages'

const EMPTY: UnidadeInput = {
  condominio_id: '',
  bloco: null,
  numero: '',
  tipo: 'apartamento',
  area_m2: null,
}

export default function UnidadeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canDelete = !isNew && isGestor(perfil?.role)

  const [form, setForm] = useState<UnidadeInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('Excluir essa unidade DEFINITIVAMENTE? Esta ação não pode ser desfeita. Se houver multas, ocorrências ou outros registros vinculados, a exclusão pode falhar.')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteUnidade(id)
      navigate('/unidades')
    } catch (e) {
      setError(traduzErro(e))
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true })
        .then(setCondos)
        .catch(() => {})
    } else if (perfil?.condominio_id) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil])

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const u = await getUnidade(id!)
        if (!mounted) return
        if (!u) {
          setError('Unidade não encontrada.')
        } else {
          setForm({
            condominio_id: u.condominio_id,
            bloco: u.bloco,
            numero: u.numero,
            tipo: u.tipo,
            area_m2: u.area_m2,
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

  function update<K extends keyof UnidadeInput>(key: K, value: UnidadeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) {
      setError('Selecione o condomínio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) await createUnidade(form)
      else await updateUnidade(id!, form)
      navigate('/unidades')
    } catch (e) {
      setError(traduzErro(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <PageHeader
        title={isNew ? 'Nova unidade' : 'Editar unidade'}
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={deleting} />
            )}
            <Link to="/unidades">
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
              onChange={(e) => update('condominio_id', e.target.value)}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-[140px_1fr] gap-4">
          <Field label="Bloco">
            <TextInput
              value={form.bloco ?? ''}
              onChange={(e) => update('bloco', e.target.value)}
              placeholder="A"
            />
          </Field>
          <Field label="Número" required>
            <TextInput
              required
              value={form.numero}
              onChange={(e) => update('numero', e.target.value)}
              placeholder="101"
            />
          </Field>
        </div>

        <Field label="Tipo" required>
          <Select
            value={form.tipo}
            onChange={(e) => update('tipo', e.target.value as TipoUnidade)}
          >
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="sala">Sala</option>
            <option value="loja">Loja</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>

        <Field label="Área (m²)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={form.area_m2 ?? ''}
            onChange={(e) =>
              update('area_m2', e.target.value === '' ? null : parseFloat(e.target.value))
            }
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
          <Link to="/unidades">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
