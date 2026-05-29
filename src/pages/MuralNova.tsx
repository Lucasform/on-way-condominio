import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { createPublicacao, uploadMuralImagem } from '../lib/mural'
import type { Condominio } from '../types/condominio'
import type { Enquete, PublicacaoInput } from '../types/mural'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'
import { traduzErro } from '../lib/errorMessages'

const MAX_IMG = 10 * 1024 * 1024 // 10 MB

const EMPTY: PublicacaoInput = {
  condominio_id: '',
  titulo: null,
  conteudo: '',
  imagem_url: null,
  fixado: false,
  expira_em: null,
}

const STORY_TTL_HOURS = 24

export default function MuralNova() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<PublicacaoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [imagem, setImagem] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [enviarEmail, setEnviarEmail] = useState(false)
  const [isStory, setIsStory] = useState(false)
  const [comEnquete, setComEnquete] = useState(false)
  const [enquetePergunta, setEnquetePergunta] = useState('')
  const [enqueteOpcoes, setEnqueteOpcoes] = useState<string[]>(['', ''])
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
      const expira_em = isStory
        ? new Date(Date.now() + STORY_TTL_HOURS * 3600_000).toISOString()
        : null
      let enquete: Enquete | null = null
      if (comEnquete) {
        const opcoes = enqueteOpcoes.map((o) => o.trim()).filter((o) => o.length > 0)
        if (opcoes.length < 2) {
          setSubmitting(false)
          return setError('A enquete precisa de pelo menos 2 opções preenchidas.')
        }
        enquete = {
          pergunta: enquetePergunta.trim() || undefined,
          opcoes,
        }
      }
      await createPublicacao(
        { ...form, imagem_url: imgPath, expira_em, enquete },
        { enviarEmail },
      )
      navigate('/mural')
    } catch (e) {
      console.warn('[mural] falha ao publicar:', e)
      setError(traduzErro(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
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

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.fixado}
              onChange={(e) => update('fixado', e.target.checked)}
              disabled={isStory}
              className="rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
            />
            📌 Fixar no topo do mural
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={comEnquete}
              onChange={(e) => setComEnquete(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
            />
            <span>
              📊 Adicionar enquete
              <span className="block text-xs text-slate-500">
                Pergunta com 2 a 4 opções. Moradores votam e veem o resultado em tempo real.
              </span>
            </span>
          </label>
          {comEnquete && (
            <div className="ml-6 mt-2 space-y-2 p-3 rounded-md border border-slate-700 bg-slate-900/40">
              <TextInput
                value={enquetePergunta}
                onChange={(e) => setEnquetePergunta(e.target.value)}
                placeholder="Pergunta (opcional, ex.: Concordam com a obra do salão?)"
                maxLength={140}
              />
              {enqueteOpcoes.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <TextInput
                    value={opt}
                    onChange={(e) => {
                      const next = [...enqueteOpcoes]
                      next[i] = e.target.value
                      setEnqueteOpcoes(next)
                    }}
                    placeholder={`Opção ${i + 1}`}
                    maxLength={80}
                  />
                  {enqueteOpcoes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setEnqueteOpcoes(enqueteOpcoes.filter((_, idx) => idx !== i))}
                      className="px-2 text-xs text-slate-400 hover:text-red-400"
                      title="Remover"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {enqueteOpcoes.length < 4 && (
                <button
                  type="button"
                  onClick={() => setEnqueteOpcoes([...enqueteOpcoes, ''])}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isStory}
              onChange={(e) => {
                setIsStory(e.target.checked)
                if (e.target.checked) update('fixado', false)
              }}
              className="mt-0.5 rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
            />
            <span>
              ⏱ Story (24h)
              <span className="block text-xs text-slate-500">
                Avisos rápidos que somem automaticamente após {STORY_TTL_HOURS} horas. Ideal pra "luz vai cair às 14h", "água amanhã".
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enviarEmail}
              onChange={(e) => setEnviarEmail(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 bg-slate-950 text-brand-700 focus:ring-brand-700"
            />
            <span>
              ✉ Enviar e-mail também para os moradores
              <span className="block text-xs text-slate-500">
                Manda esta publicação por e-mail pra todos os moradores ativos com e-mail cadastrado.
              </span>
            </span>
          </label>
        </div>

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
