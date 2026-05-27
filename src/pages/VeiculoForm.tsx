import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createVeiculo, deleteVeiculo, getVeiculo, updateVeiculo } from '../lib/veiculos'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import type { VeiculoInput, TipoVeiculo } from '../types/veiculo'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, Select } from '../components/ui/Input'

const EMPTY: VeiculoInput = {
  condominio_id: '',
  unidade_id: '',
  pessoa_id: null,
  placa: '',
  modelo: null,
  cor: null,
  tipo: 'carro',
  vaga: null,
}

export default function VeiculoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canDelete = !isNew && isGestor(perfil?.role)

  const [form, setForm] = useState<VeiculoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!id) return
    if (!window.confirm(`Excluir o veículo ${form.placa || ''} DEFINITIVAMENTE?`)) return
    setDeleting(true)
    try {
      await deleteVeiculo(id)
      navigate('/veiculos')
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
        const v = await getVeiculo(id!)
        if (!mounted) return
        if (!v) setError('Veículo não encontrado.')
        else {
          setForm({
            condominio_id: v.condominio_id,
            unidade_id: v.unidade_id,
            pessoa_id: v.pessoa_id,
            placa: v.placa,
            modelo: v.modelo,
            cor: v.cor,
            tipo: v.tipo,
            vaga: v.vaga,
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

  function update<K extends keyof VeiculoInput>(key: K, value: VeiculoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.unidade_id) return setError('Selecione a unidade.')
    setSaving(true)
    setError(null)
    try {
      if (isNew) await createVeiculo(form)
      else await updateVeiculo(id!, form)
      navigate('/veiculos')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        title={isNew ? 'Novo veículo' : 'Editar veículo'}
        actions={
          <div className="flex items-center gap-2">
            {canDelete && <DeleteButton onClick={handleDelete} disabled={deleting} />}
            <Link to="/veiculos">
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

        <Field label="Dono (opcional)">
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

        <div className="grid grid-cols-[1fr_1fr] gap-4">
          <Field label="Placa" required hint="Sem hífen, ex: ABC1D23">
            <TextInput
              required
              value={form.placa}
              onChange={(e) => update('placa', e.target.value.toUpperCase())}
              className="font-mono"
            />
          </Field>
          <Field label="Tipo" required>
            <Select
              value={form.tipo}
              onChange={(e) => update('tipo', e.target.value as TipoVeiculo)}
            >
              <option value="carro">Carro</option>
              <option value="moto">Moto</option>
              <option value="bicicleta">Bicicleta</option>
              <option value="utilitario">Utilitário</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Modelo">
            <TextInput
              value={form.modelo ?? ''}
              onChange={(e) => update('modelo', e.target.value)}
              placeholder="Honda Civic 2021"
            />
          </Field>
          <Field label="Cor">
            <TextInput
              value={form.cor ?? ''}
              onChange={(e) => update('cor', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Vaga">
          <TextInput
            value={form.vaga ?? ''}
            onChange={(e) => update('vaga', e.target.value)}
            placeholder="G1-15"
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
          <Link to="/veiculos">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
