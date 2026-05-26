import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPessoa, deletePessoa, getPessoa, updatePessoa } from '../lib/pessoas'
import { supabase } from '../lib/supabase'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { PessoaInput, TipoVinculo, RelacaoUnidade } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
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
  const canDelete = !isNew && (perfil?.role === 'admin_onway' || perfil?.role === 'sindico')

  const [form, setForm] = useState<PessoaInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!id) return
    if (!window.confirm(`Excluir "${form.nome || 'essa pessoa'}" DEFINITIVAMENTE? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    setError(null)
    try {
      await deletePessoa(id)
      navigate('/pessoas')
    } catch (e) {
      setError(traduzErro(e))
      setDeleting(false)
    }
  }

  // --- Upload de foto ---
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const FOTO_BUCKET = 'fotos-pessoas'
  const MAX_FOTO_BYTES = 2 * 1024 * 1024 // 2 MB
  const VALID_FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

  function extrairPathDoPublicUrl(url: string): string | null {
    const marker = `/${FOTO_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return url.slice(idx + marker.length)
  }

  async function handleFotoChange(file: File | null) {
    if (!file) return
    if (!form.condominio_id) {
      setError('Selecione o condomínio antes de enviar a foto.')
      return
    }
    if (!VALID_FOTO_TYPES.includes(file.type)) {
      setError('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_FOTO_BYTES) {
      setError(`Imagem muito grande. Máximo ${Math.round(MAX_FOTO_BYTES / 1024 / 1024)} MB.`)
      return
    }
    setUploadingFoto(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${form.condominio_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(FOTO_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(FOTO_BUCKET).getPublicUrl(path)
      const novaUrl = pub.publicUrl

      // Apaga foto anterior se for do mesmo bucket (best-effort)
      if (form.foto_url) {
        const prevPath = extrairPathDoPublicUrl(form.foto_url)
        if (prevPath) {
          supabase.storage.from(FOTO_BUCKET).remove([prevPath]).catch(() => {})
        }
      }

      update('foto_url', novaUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setUploadingFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  async function handleRemoverFoto() {
    if (!form.foto_url) return
    if (!window.confirm('Remover a foto?')) return
    const prevPath = extrairPathDoPublicUrl(form.foto_url)
    if (prevPath) {
      supabase.storage.from(FOTO_BUCKET).remove([prevPath]).catch(() => {})
    }
    update('foto_url', null)
  }

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
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={deleting} />
            )}
            <Link to="/pessoas">
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

        <Field label="Foto">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto || !form.condominio_id}
              title={form.foto_url ? 'Trocar foto' : 'Adicionar foto'}
              className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800 hover:border-brand-500 transition disabled:opacity-50"
            >
              {form.foto_url ? (
                <img
                  src={form.foto_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-slate-500">
                  <UserPlaceholderIcon />
                </span>
              )}
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center border-2 border-slate-950 pointer-events-none">
                <CameraIcon />
              </span>
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFotoChange(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto || !form.condominio_id}
                className="text-sm text-brand-700 dark:text-brand-400 hover:underline disabled:opacity-50 text-left"
              >
                {uploadingFoto ? 'Enviando...' : form.foto_url ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {form.foto_url && !uploadingFoto && (
                <button
                  type="button"
                  onClick={handleRemoverFoto}
                  className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 text-left"
                >
                  remover
                </button>
              )}
              {!form.condominio_id && (
                <span className="text-[11px] text-slate-500">Selecione o condomínio antes.</span>
              )}
            </div>
          </div>
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

function UserPlaceholderIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
