import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'

interface Props {
  condominio_id: string
  current?: string | null
  onChange: (url: string | null) => void
}

const BUCKET = 'condo-logos'
const MAX_MB = 5

/**
 * Upload de imagem de fundo da tela de login. Usa bucket público
 * `condo-logos` com path `<condominio_id>/login-bg-*.<ext>` pra reuso
 * de bucket existente. Salva a URL pública em `condominios.imagem_login_url`.
 */
export default function LoginBgUpload({ condominio_id, current, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setError('Use PNG, JPG ou WebP.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Máx ${MAX_MB}MB.`)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${condominio_id}/login-bg-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const url = pub.publicUrl
      const { error: dbErr } = await supabase
        .from('condominios')
        .update({ imagem_login_url: url })
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
    if (!window.confirm('Remover imagem de fundo?')) return
    setUploading(true)
    setError(null)
    try {
      const { error: dbErr } = await supabase
        .from('condominios')
        .update({ imagem_login_url: null })
        .eq('id', condominio_id)
      if (dbErr) throw dbErr
      onChange(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 flex-wrap">
        {current ? (
          <a href={current} target="_blank" rel="noreferrer" className="block shrink-0">
            <img
              src={current}
              alt="Preview"
              className="h-24 w-40 object-cover rounded-md border border-slate-700 bg-slate-900"
            />
          </a>
        ) : (
          <div className="h-24 w-40 rounded-md border border-dashed border-slate-700 bg-slate-900/50 flex items-center justify-center text-xs text-slate-500 shrink-0">
            Sem imagem
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()} loading={uploading} size="sm">
            {current ? 'Trocar imagem' : '+ Anexar imagem'}
          </Button>
          {current && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={uploading}>
              Remover
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      <div className="text-xs text-slate-500">
        Aparece como background da tela de login. PNG, JPG ou WebP até {MAX_MB}MB.
      </div>
      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
