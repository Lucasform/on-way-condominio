import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import { createOcorrencia, uploadOcorrenciaFoto } from '../lib/ocorrencias'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10 MB

interface FormState {
  condominio_id: string
  unidade_id: string
  local: string
  descricao: string
}

const EMPTY: FormState = {
  condominio_id: '',
  unidade_id: '',
  local: '',
  descricao: '',
}

export default function OcorrenciaNova() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<FormState>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [foto, setFoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
    if (!form.condominio_id) {
      setUnidades([])
      return
    }
    listUnidades({ condominio_id: form.condominio_id, ativo: true })
      .then(setUnidades)
      .catch(() => {})
  }, [form.condominio_id])

  // Limpa o object URL ao desmontar ou trocar foto
  useEffect(() => {
    if (!foto) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(foto)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setFoto(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Imagem muito grande (máx ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB).`)
      e.target.value = ''
      return
    }
    setFoto(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.descricao.trim()) return setError('Descrição é obrigatória.')

    setSubmitting(true)
    setError(null)
    try {
      let fotoPath: string | null = null
      if (foto) {
        fotoPath = await uploadOcorrenciaFoto(form.condominio_id, foto)
      }
      await createOcorrencia(
        {
          condominio_id: form.condominio_id,
          unidade_id: form.unidade_id || null,
          pessoa_envolvida_id: null,
          local: form.local,
          descricao: form.descricao,
          foto_url: fotoPath,
        },
        user.id,
      )
      navigate('/ocorrencias')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <PageHeader
        title="Registrar ocorrência"
        subtitle="Descreva o que aconteceu. Adicione foto se possível."
        actions={
          <Link to="/ocorrencias">
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
                update('unidade_id', '')
              }}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Unidade (opcional)" hint="Se a ocorrência for específica de uma unidade.">
          <Select
            value={form.unidade_id}
            onChange={(e) => update('unidade_id', e.target.value)}
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

        <Field label="Local" hint='Ex: "Garagem G1", "Elevador social", "Piscina"'>
          <TextInput
            value={form.local}
            onChange={(e) => update('local', e.target.value)}
          />
        </Field>

        <Field label="Descrição" required>
          <TextArea
            required
            rows={5}
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            placeholder="Descreva o que aconteceu, quando, e quem estava envolvido (se souber)."
          />
        </Field>

        <Field label="Foto (opcional)" hint="JPG/PNG, até 10 MB.">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-200 file:cursor-pointer hover:file:bg-slate-700"
          />
        </Field>

        {previewUrl && (
          <div className="rounded-md border border-slate-800 overflow-hidden max-w-md">
            <img src={previewUrl} alt="Preview" className="w-full h-auto" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar ocorrência'}
          </Button>
          <Link to="/ocorrencias">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
