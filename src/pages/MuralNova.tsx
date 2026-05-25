import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { createPublicacao, uploadMuralImagem } from '../lib/mural'
import type { Condominio } from '../types/condominio'
import type { PublicacaoInput } from '../types/mural'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const MAX_IMG = 10 * 1024 * 1024 // 10 MB

const EMPTY: PublicacaoInput = {
  condominio_id: '',
  titulo: null,
  conteudo: '',
  imagem_url: null,
  fixado: false,
}

export default function MuralNova() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway'

  const [form, setForm] = useState<PublicacaoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [imagem, setImagem] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
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
    if (!imagem) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(imagem)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imagem])

  function update<K extends keyof PublicacaoInput>(key: K, value: PublicacaoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) return setImagem(null)
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMG) {
      setError(`Imagem muito grande (máx ${Math.round(MAX_IMG / 1024 / 1024)} MB).`)
      e.target.value = ''
      return
    }
    setImagem(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.conteudo.trim()) return setError('O conteúdo é obrigatório.')

    setSubmitting(true)
    setError(null)
    try {
      let imgPath: string | null = null
      if (imagem) {
        imgPath = await uploadMuralImagem(form.condominio_id, imagem)
      }
      await createPublicacao({ ...form, imagem_url: imgPath })
      navigate('/mural')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <PageHeader
        title="Nova publicação"
        subtitle="Comunique algo ao condomínio. Aparece no mural pra todos os moradores."
        actions={
          <Link to="/mural">
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
              onChange={(e) => update('condominio_id', e.target.value)}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Título (opcional)">
          <TextInput
            value={form.titulo ?? ''}
            onChange={(e) => update('titulo', e.target.value)}
            placeholder="Ex: Manutenção da piscina"
          />
        </Field>

        <Field label="Conteúdo" required>
          <TextArea
            required
            rows={6}
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            placeholder="Escreva o comunicado..."
          />
        </Field>

        <Field label="Imagem (opcional)" hint="JPG/PNG, até 10 MB.">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-200 file:cursor-pointer hover:file:bg-slate-700"
          />
        </Field>

        {preview && (
          <div className="rounded-md border border-slate-800 overflow-hidden max-w-md">
            <img src={preview} alt="Preview" className="w-full h-auto" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.fixado}
            onChange={(e) => update('fixado', e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
          />
          📌 Fixar no topo do mural
        </label>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Publicando...' : 'Publicar'}
          </Button>
          <Link to="/mural">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
