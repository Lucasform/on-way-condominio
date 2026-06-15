import { supabase } from './supabase'
import type { Classificado, ClassificadoInput, StatusClassificado } from '../types/classificado'

const SELECT = 'id,condominio_id,criado_por,titulo,descricao,categoria,preco,fotos,status,link_externo,meta,created_at,updated_at'

export async function listClassificados(opts: {
  condominio_id?: string
  categoria?: string
  status?: StatusClassificado
} = {}): Promise<Classificado[]> {
  let q = supabase
    .from('classificados')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.categoria) q = q.eq('categoria', opts.categoria)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Classificado[]
}

export async function getClassificado(id: string): Promise<Classificado | null> {
  const { data, error } = await supabase
    .from('classificados')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Classificado | null
}

export async function createClassificado(input: ClassificadoInput, userId?: string): Promise<Classificado> {
  const { data, error } = await supabase
    .from('classificados')
    .insert({ ...input, criado_por: userId ?? null })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Classificado
}

export async function updateClassificado(id: string, input: Partial<ClassificadoInput & { status: StatusClassificado }>): Promise<Classificado> {
  const { data, error } = await supabase
    .from('classificados')
    .update(input)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Classificado
}

export async function deleteClassificado(id: string): Promise<void> {
  const { error } = await supabase.from('classificados').delete().eq('id', id)
  if (error) throw error
}

export async function uploadFotoClassificado(
  file: File,
  condominio_id: string,
  classificado_id: string,
): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${condominio_id}/${classificado_id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('classificados').upload(path, file, {
    upsert: true,
    cacheControl: '86400',
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('classificados').getPublicUrl(path)
  return data.publicUrl
}

export async function removeFotoClassificado(url: string): Promise<void> {
  const path = url.split('/classificados/').pop()
  if (!path) return
  await supabase.storage.from('classificados').remove([path])
}
