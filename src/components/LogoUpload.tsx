import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  condominio_id: string
  current?: string | null
  onChange: (url: string | null) => void
}

export default function LogoUpload({ condominio_id, current, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!/^image\/(png|jpeg|jpg|svg\+xml|webp)$/.test(file.type)) {
      setError('Use PNG, JPG, SVG ou WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Máx 2MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${condominio_id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('condo-logos')
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('condo-logos').getPublicUrl(path)
      const url = pub.publicUrl
      const { error: dbErr } = await supabase
        .from('condominios')
        .update({ logo_url: url })
        .eq('id', condominio_id)
      if (dbErr) throw dbErr
      onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remover logo?')) return
    setUploading(true)
    try {
      await supabase.from('condominios').update({ logo_url: null }).eq('id', condominio_id)
      onChange(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
        {current ? (
          <img src={current} alt="Logo" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">sem logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 rounded text-xs font-medium bg-brand-700 hover:bg-brand-800 text-white disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : current ? 'Trocar logo' : 'Enviar logo'}
        </button>
        {current && (
          <button
            type="button"
            disabled={uploading}
            onClick={handleRemove}
            className="text-xs text-red-700 dark:text-red-400 hover:underline text-left"
          >
            Remover
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
        <span className="text-[10px] text-slate-500">PNG/JPG/SVG · máx 2MB</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  )
}
