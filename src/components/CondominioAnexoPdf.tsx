import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  condominio_id: string
  /** Coluna em `condominios` que guarda a URL pública (ex: 'regimento_pdf_url'). */
  campo: 'regimento_pdf_url' | 'modelo_notificacao_url'
  /** Subpasta dentro do bucket condominio-anexos. */
  subpasta: 'regimento' | 'modelo-notificacao'
  /** Tipo enviado pra edge parse-condominio-pdf. */
  tipoIa: 'regimento' | 'modelo'
  titulo: string
  emoji: string
  descricao: string
  current: string | null
  onChange: (url: string | null) => void
  /** Texto de status pós-processamento (ex.: "12 artigos cadastrados"). */
  statusProcessamento?: string | null
}

const BUCKET = 'condominio-anexos'
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export default function CondominioAnexoPdf({
  condominio_id,
  campo,
  subpasta,
  tipoIa,
  titulo,
  emoji,
  descricao,
  current,
  onChange,
  statusProcessamento,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [resultadoProc, setResultadoProc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleProcessar() {
    setProcessando(true)
    setError(null)
    setResultadoProc(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('parse-condominio-pdf', {
        body: { condominio_id, tipo: tipoIa },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      if (tipoIa === 'regimento') {
        setResultadoProc(
          `${data?.artigos_criados ?? 0} artigos novos extraídos` +
            (data?.artigos_duplicados ? ` (${data.artigos_duplicados} já existiam)` : ''),
        )
      } else {
        setResultadoProc(`Padrão de redação salvo (${data?.chars_salvos ?? 0} caracteres).`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar.')
    } finally {
      setProcessando(false)
    }
  }

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

      {current && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleProcessar}
              disabled={processando}
              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            >
              {processando
                ? 'Processando...'
                : tipoIa === 'regimento'
                ? '🤖 Extrair artigos automaticamente'
                : '🤖 Treinar estilo de redação'}
            </button>
            {statusProcessamento && !resultadoProc && (
              <span className="text-[11px] text-slate-400 italic">{statusProcessamento}</span>
            )}
          </div>
          {resultadoProc && (
            <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
              ✓ {resultadoProc}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            {tipoIa === 'regimento'
              ? 'Lê o PDF, divide em artigos pelos padrões "Art. X" e gera embeddings vetoriais. A IA usa pra achar fundamento das ocorrências.'
              : 'Lê o PDF, extrai o texto e usa como referência de tom/estilo quando a IA gerar uma minuta de multa ou notificação.'}
          </p>
        </div>
      )}
    </fieldset>
  )
}
