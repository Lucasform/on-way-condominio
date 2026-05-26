import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPessoa, getPessoa, updatePessoa } from '../lib/pessoas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { PessoaInput, TipoVinculo, RelacaoUnidade } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'
import { traduzErro } from '../lib/errorMessages'

const EMPTY: PessoaInput = {
  condominio_id: '',
  unidade_id: null,
  nome: '',
  cpf: null,
  email: null,
  telefone: null,
  data_nascimento: null,
  tipo_vinculo: 'morador',
  relacao_unidade: 'morador',
  foto_url: null,
}

export default function PessoaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<PessoaInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carrega condomínios (admin) ou usa o do perfil
  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true })
        .then(setCondos)
        .catch(() => {})
    } else if (perfil?.condominio_id && isNew) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil, isNew])

  // Carrega unidades do condomínio escolhido
  useEffect(() => {
    if (!form.condominio_id) {
      setUnidades([])
      return
    }
    listUnidades({ condominio_id: form.condominio_id, ativo: true })
      .then(setUnidades)
      .catch(() => {})
  }, [form.condominio_id])

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const p = await getPessoa(id!)
        if (!mounted) return
        if (!p) {
          setError('Pessoa não encontrada.')
        } else {
          setForm({
            condominio_id: p.condominio_id,
            unidade_id: p.unidade_id,
            nome: p.nome,
            cpf: p.cpf,
            email: p.email,
            telefone: p.telefone,
            data_nascimento: p.data_nascimento,
            tipo_vinculo: p.tipo_vinculo,
            relacao_unidade: p.relacao_unidade,
            foto_url: p.foto_url,
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

  function update<K extends keyof PessoaInput>(key: K, value: PessoaInput[K]) {
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
      if (isNew) await createPessoa(form)
      else await updatePessoa(id!, form)
      navigate('/pessoas')
    } catch (e) {
      setError(traduzErro(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        title={isNew ? 'Nova pessoa' : 'Editar pessoa'}
        actions={
          <Link to="/pessoas">
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

        <Field label="Nome" required>
          <TextInput
            required
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="CPF" hint="11 dígitos">
            <TextInput
              value={form.cpf ?? ''}
              onChange={(e) => update('cpf', e.target.value)}
            />
          </Field>
          <Field label="Data de nascimento">
            <TextInput
              type="date"
              value={form.data_nascimento ?? ''}
              onChange={(e) => update('data_nascimento', e.target.value || null)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email ?? ''}
              onChange={(e) => update('email', e.target.value)}
            />
          </Field>
          <Field label="Telefone" hint="DDD + número">
            <TextInput
              value={form.telefone ?? ''}
              onChange={(e) => update('telefone', e.target.value)}
              placeholder="11999990000"
            />
          </Field>
        </div>

        <fieldset className="border-t border-slate-800 pt-5">
          <legend className="text-sm font-semibold text-slate-300 mb-3 px-2 -ml-2">Vínculo</legend>

          <div className="space-y-5">
            <Field label="Unidade">
              <Select
                value={form.unidade_id ?? ''}
                onChange={(e) => update('unidade_id', e.target.value || null)}
                disabled={!form.condominio_id}
              >
                <option value="">Sem unidade vinculada</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de vínculo">
                <Select
                  value={form.tipo_vinculo}
                  onChange={(e) => update('tipo_vinculo', e.target.value as TipoVinculo)}
                >
                  <option value="titular">Titular</option>
                  <option value="conjuge">Cônjuge</option>
                  <option value="filho">Filho(a)</option>
                  <option value="dependente">Dependente</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="funcionario">Funcionário</option>
                  <option value="morador">Morador</option>
                  <option value="outro">Outro</option>
                </Select>
              </Field>
              <Field label="Relação com a unidade">
                <Select
                  value={form.relacao_unidade ?? ''}
                  onChange={(e) =>
                    update('relacao_unidade', (e.target.value || null) as RelacaoUnidade)
                  }
                >
                  <option value="">—</option>
                  <option value="proprietario">Proprietário</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="morador">Morador</option>
                </Select>
              </Field>
            </div>
          </div>
        </fieldset>

        <Field label="Foto (URL)">
          <TextInput
            value={form.foto_url ?? ''}
            onChange={(e) => update('foto_url', e.target.value)}
            placeholder="https://..."
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
          <Link to="/pessoas">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
