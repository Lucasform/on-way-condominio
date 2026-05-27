import { supabase } from './supabase'
import type { Assembleia, AssembleiaInput, AssembleiaPresenca } from '../types/assembleia'

const SELECT = 'id,condominio_id,titulo,tipo,data_assembleia,local,status,pauta,ata_url,ata_texto,observacoes,criado_por,created_at,updated_at'

export async function listAssembleias(opts: { condominio_id?: string } = {}): Promise<Assembleia[]> {
  let q = supabase
    .from('assembleias')
    .select(SELECT)
    .order('data_assembleia', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Assembleia[]
}

export async function getAssembleia(id: string): Promise<Assembleia | null> {
  const { data, error } = await supabase
    .from('assembleias')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Assembleia | null
}

export async function createAssembleia(input: AssembleiaInput, userId?: string): Promise<Assembleia> {
  const { data, error } = await supabase
    .from('assembleias')
    .insert({
      ...input,
      criado_por: userId ?? null,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Assembleia
}

export async function updateAssembleia(id: string, input: Partial<AssembleiaInput>): Promise<Assembleia> {
  const { data, error } = await supabase
    .from('assembleias')
    .update(input)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Assembleia
}

export async function deleteAssembleia(id: string): Promise<void> {
  const { error } = await supabase.from('assembleias').delete().eq('id', id)
  if (error) throw error
}

export async function uploadAta(file: File, condominio_id: string, assembleia_id: string): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase()
  const path = `${condominio_id}/${assembleia_id}/ata-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('assembleia-atas').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'application/pdf',
  })
  if (upErr) throw upErr
  return path
}

export async function getAtaSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('assembleia-atas')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function removeAta(path: string): Promise<void> {
  if (!path) return
  await supabase.storage.from('assembleia-atas').remove([path])
}

// ============================================================
// Presencas (Leva H)
// ============================================================

export async function listPresencas(assembleia_id: string): Promise<AssembleiaPresenca[]> {
  const { data, error } = await supabase
    .from('assembleia_presencas')
    .select('*')
    .eq('assembleia_id', assembleia_id)
    .order('confirmou_em')
  if (error) throw error
  return (data ?? []) as AssembleiaPresenca[]
}

export async function confirmarPresenca(assembleia_id: string, user_id: string): Promise<void> {
  const { error } = await supabase
    .from('assembleia_presencas')
    .upsert(
      { assembleia_id, user_id, confirmou_em: new Date().toISOString() },
      { onConflict: 'assembleia_id,user_id' },
    )
  if (error) throw error
}

export async function cancelarPresenca(assembleia_id: string, user_id: string): Promise<void> {
  const { error } = await supabase
    .from('assembleia_presencas')
    .delete()
    .eq('assembleia_id', assembleia_id)
    .eq('user_id', user_id)
  if (error) throw error
}

export async function marcarPresente(presenca_id: string): Promise<void> {
  const { error } = await supabase
    .from('assembleia_presencas')
    .update({ presente_em: new Date().toISOString() })
    .eq('id', presenca_id)
  if (error) throw error
}
