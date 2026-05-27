import { supabase } from './supabase'

export type TipoAnexo = 'regimento' | 'modelo_notificacao' | 'modelo_multa' | 'outro'

export interface CondominioAnexo {
  id: string
  condominio_id: string
  tipo: TipoAnexo
  nome: string
  url: string
  texto_extraido: string | null
  artigos_extraidos: number | null
  processado_em: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export const TIPO_LABEL: Record<TipoAnexo, string> = {
  regimento: 'Regimento interno',
  modelo_notificacao: 'Modelo de notificação',
  modelo_multa: 'Modelo de multa',
  outro: 'Outro',
}

const BUCKET = 'condominio-anexos'

export async function listAnexos(condominio_id: string, tipo?: TipoAnexo): Promise<CondominioAnexo[]> {
  let q = supabase.from('condominio_anexos').select('*').eq('condominio_id', condominio_id).order('created_at', { ascending: false })
  if (tipo) q = q.eq('tipo', tipo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CondominioAnexo[]
}

export async function createAnexo(input: {
  condominio_id: string
  tipo: TipoAnexo
  nome: string
  file: File
}): Promise<CondominioAnexo> {
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${input.condominio_id}/${input.tipo}/${Date.now()}-${input.nome.replace(/[^a-z0-9-_]/gi, '_').slice(0, 40)}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
  if (upErr) throw upErr
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('condominio_anexos')
    .insert({
      condominio_id: input.condominio_id,
      tipo: input.tipo,
      nome: input.nome.trim(),
      url: pub.publicUrl,
      ativo: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CondominioAnexo
}

export async function renomearAnexo(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('condominio_anexos').update({ nome: nome.trim() }).eq('id', id)
  if (error) throw error
}

export async function toggleAnexoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('condominio_anexos').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deleteAnexo(anexo: CondominioAnexo): Promise<void> {
  const marker = `/${BUCKET}/`
  const idx = anexo.url.indexOf(marker)
  if (idx !== -1) {
    const path = anexo.url.slice(idx + marker.length)
    supabase.storage.from(BUCKET).remove([path]).catch(() => {})
  }
  const { error } = await supabase.from('condominio_anexos').delete().eq('id', anexo.id)
  if (error) throw error
}

export async function processarAnexoIa(anexo_id: string): Promise<{
  ok: boolean
  artigos_criados?: number
  artigos_duplicados?: number
  chars_salvos?: number
  error?: string
}> {
  const { data, error } = await supabase.functions.invoke('parse-condominio-pdf', {
    body: { anexo_id },
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, ...data }
}
