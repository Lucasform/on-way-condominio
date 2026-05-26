import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createRegimentoArtigo,
  getRegimentoArtigo,
  updateRegimentoArtigo,
} from '../lib/regimento'
import { regenerateEmbedding } from '../lib/iaAnalysis'
import { listCondominios } from '../lib/condominios'
import type { RegimentoArtigoInput } from '../types/regimento'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: RegimentoArtigoInput = {
  condominio_id: '',
  numero: null,
  titulo: '',
  conteudo: '',
  ordem: 0,
}

export default function RegimentoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<RegimentoArtigoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id && isNew) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil, isNew])

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const a = await getRegimentoArtigo(id!)
        if (!mounted) return
        if (!a) {
          setError('Artigo não encontrado.')
        } else {
          setForm({
            condominio_id: a.condominio_id,
            numero: a.numero,
            titulo: a.titulo,
            conteudo: a.conteudo,
            ordem: a.ordem,
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

  function update<K extends keyof RegimentoArtigoInput>(key: K, value: RegimentoArtigoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.titulo.trim() || !form.conteudo.trim())
      return setError('Título e conteúdo são obrigatórios.')

    setSaving(true)
    setError(null)
    try {
      const textoPraEmbedding = `${form.titulo.trim()}\n\n${form.conteudo.trim()}`
      let artigoId: string
      if (isNew) {
        const novo = await createRegimentoArtigo(form)
        artigoId = novo.id
      } else {
        await updateRegimentoArtigo(id!, form)
        artigoId = id!
      }
      // Gera embedding em background — não bloqueia o redirect.
      // Se falhar, o artigo ainda fica salvo; embedding pode ser regenerado depois.
      regenerateEmbedding(artigoId, textoPraEmbedding).catch((err) => {
        console.warn('[regimento] falha ao gerar embedding:', err)
      })
      navigate('/regimento')
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
        title={isNew ? 'Novo artigo do regimento' : 'Editar artigo'}
        actions={
          <Link to="/regimento">
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

        <div className="grid grid-cols-[180px_1fr] gap-4">
          <Field label="Número" hint='Ex: "Art. 18", "18.2", "§3º"'>
            <TextInput
              value={form.numero ?? ''}
              onChange={(e) => update('numero', e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Título" required>
            <TextInput
              required
              value={form.titulo}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Uso das áreas comuns"
            />
          </Field>
        </div>

        <Field label="Conteúdo" required hint="Texto completo do artigo. A IA vai usar este conteúdo para análise.">
          <TextArea
            required
            rows={10}
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            placeholder="Digite ou cole o texto completo do artigo..."
          />
        </Field>

        <Field label="Ordem" hint="Para ordenar a lista. Quanto menor, primeiro.">
          <TextInput
            type="number"
            value={String(form.ordem)}
            onChange={(e) => update('ordem', parseInt(e.target.value, 10) || 0)}
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
          <Link to="/regimento">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
