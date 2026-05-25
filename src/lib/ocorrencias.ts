import { supabase } from './supabase'
import type { Ocorrencia, OcorrenciaInput, StatusOcorrencia } from '../types/ocorrencia'

const BUCKET = 'ocorrencia-fotos'

export async function listOcorrencias(opts: {
  condominio_id?: string
  status?: StatusOcorrencia
} = {}): Promise<Ocorrencia[]> {
  let q = supabase
    .from('ocorrencias')
    .select('*')
    .order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Ocorrencia[]
}

export async function getOcorrencia(id: string): Promise<Ocorrencia | null> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Ocorrencia | null
}

export async function createOcorrencia(input: OcorrenciaInput, reportado_por: string): Promise<Ocorrencia> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id || null,
      pessoa_envolvida_id: input.pessoa_envolvida_id || null,
      local: input.local?.trim() || null,
      descricao: input.descricao.trim(),
      foto_url: input.foto_url || null,
      reportado_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Ocorrencia
}

export async function updateOcorrenciaStatus(id: string, status: StatusOcorrencia): Promise<void> {
  const { error } = await supabase.from('ocorrencias').update({ status }).eq('id', id)
  if (error) throw error
}

// ============================================================
// Storage helpers — fotos de ocorrência
// ============================================================
// Convenção de path: <condominio_id>/<uuid>.<ext>
// O bucket é privado; leitura usa signed URL gerada sob demanda.

export async function uploadOcorrenciaFoto(
  condominioId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeExt = ext.length && ext.length <= 5 ? ext : 'jpg'
  const path = `${condominioId}/${crypto.randomUUID()}.${safeExt}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getOcorrenciaFotoSignedUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error) {
    console.warn('[ocorrencia] falha ao gerar signed URL:', error.message)
    return null
  }
  return data.signedUrl
}
