import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClassificado, uploadFotoClassificado } from '../lib/classificados'
import type { CategoriaClassificado } from '../types/classificado'
import { CATEGORIA_LABEL } from '../types/classificado'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaClassificado[]

export default function ClassificadoNovo() {
  const { perfil, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const condoId = perfil?.condominio_id ?? ''

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaClassificado>('outros')
  const [preco, setPreco] = useState('')
  const [linkExterno, setLinkExterno] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleFotos(files: FileList | null) {
    if (!files || !condoId) return
    setUploading(true)
    const id = `tmp-${Date.now()}`
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 5)) {
        const url = await uploadFotoClassificado(file, condoId, id)
        urls.push(url)
      }
      setFotos((prev) => [...prev, ...urls].slice(0, 5))
    } catch (e) {
      toast.error('Erro ao subir foto', e instanceof Error ? e.message : '')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !condoId) return
    setSaving(true)
    try {
      const c = await createClassificado({
        condominio_id: condoId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria,
        preco: preco ? parseFloat(preco.replace(',', '.')) : null,
        fotos,
        link_externo: linkExterno.trim() || null,
      }, user?.id)
      toast.success('Anúncio publicado.')
      navigate(`/classificados/${c.id}`)
    } catch (e) {
      toast.error('Erro ao publicar', e instanceof Error ? e.message : '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Novo anúncio"
        actions={<Link to="/classificados"><Button variant="ghost">← Voltar</Button></Link>}
      />

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Título *</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            placeholder="Ex: Sofá 3 lugares em bom estado"
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaClassificado)}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 outline-none"
          >
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>{CATEGORIA_LABEL[cat]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Preço (R$)</label>
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Deixe em branco para 'a combinar'"
            type="text"
            inputMode="decimal"
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            placeholder="Detalhes do item, estado de conservação, contato..."
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Fotos (máx. 5)
            {uploading && <span className="ml-2 text-slate-500">Enviando...</span>}
          </label>
          {fotos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {fotos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden bg-slate-800 border border-slate-700">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {fotos.length < 5 && (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition">
                + Adicionar foto
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFotos(e.target.files)}
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Link externo <span className="text-slate-600">(opcional — marketplace futuro)</span>
          </label>
          <input
            value={linkExterno}
            onChange={(e) => setLinkExterno(e.target.value)}
            placeholder="https://..."
            type="url"
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || !titulo.trim()}>
            {saving ? 'Publicando...' : 'Publicar anúncio'}
          </Button>
          <Link to="/classificados">
            <Button variant="ghost" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
