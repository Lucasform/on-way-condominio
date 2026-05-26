import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  condominio_id: string
  /** Coluna em `condominios` que guarda a URL pública (ex: 'regimento_pdf_url'). */
  campo: 'regimento_pdf_url' | 'modelo_notificacao_url'
  /** Subpasta dentro do bucket condominio-anexos. */
  subpasta: 'regimento' | 'modelo-notificacao'
  titulo: string
  emoji: string
  descricao: string
  current: string | null
  onChange: (url: string | null) => void
  /** Mensagem extra exibida abaixo (ex.: "extração automática virá em breve"). */
  hint?: string
}

const BUCKET = 'condominio-anexos'
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export default function CondominioAnexoPdf({
  condominio_id,
  campo,
  subpasta,
  titulo,
  emoji,
  descricao,
  current,
  onChange,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function extrairPath(url: string): string | null {
    const marker = `/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return url.slice(idx + marker.length)
  }

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Aceita apenas arquivo PDF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Arquivo muito grande. Máximo ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const path = `${condominio_id}/${subpasta}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const url = pub.publicUrl

      const { error: updErr } = await supabase
        .from('condominios')
        .update({ [campo]: url })
        .eq('id', condominio_id)
      if (updErr) throw updErr

      // Apaga PDF anterior (best-effort)
      if (current) {
        const prev = extrairPath(current)
        if (prev) supabase.storage.from(BUCKET).remove([prev]).catch(() => {})
      }
      onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!current) return
    if (!window.confirm('Remover o PDF anexado?')) return
    setUploading(true)
    setError(null)
    try {
      const prev = extrairPath(current)
      const { error: updErr } = await supabase
        .from('condominios')
        .update({ [campo]: null })
        .eq('id', condominio_id)
      if (updErr) throw updErr
      if (prev) supabase.storage.from(BUCKET).remove([prev]).catch(() => {})
      onChange(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <fieldset className="border border-slate-700 rounded-md p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-slate-200">
        {emoji} {titulo}
      </legend>
      <p className="text-xs text-slate-400 -mt-2">{descricao}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : current ? 'Trocar PDF' : 'Anexar PDF'}
        </button>
        {current && (
          <>
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 hover:underline"
            >
              📄 Ver PDF atual
            </a>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-slate-500 hover:text-red-400 ml-auto"
            >
              remover
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {hint && (
        <p className="text-[11px] text-slate-500 italic">{hint}</p>
      )}
    </fieldset>
  )
}
