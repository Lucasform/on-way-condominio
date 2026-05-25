import { supabase } from './supabase'
import type { Publicacao, PublicacaoInput, Reacao, TipoReacao } from '../types/mural'

const BUCKET = 'mural-imagens'

// ============================================================
// Publicacoes
// ============================================================

export async function listPublicacoes(opts: { condominio_id?: string } = {}): Promise<Publicacao[]> {
  let q = supabase
    .from('publicacoes')
    .select('*')
    .eq('ativo', true)
    .order('fixado', { ascending: false })
    .order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Publicacao[]
}

export async function createPublicacao(input: PublicacaoInput): Promise<Publicacao> {
  const { data, error } = await supabase
    .from('publicacoes')
    .insert({
      condominio_id: input.condominio_id,
      titulo: input.titulo?.trim() || null,
      conteudo: input.conteudo.trim(),
      imagem_url: input.imagem_url || null,
      fixado: input.fixado,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Publicacao
}

export async function deletePublicacao(id: string): Promise<void> {
  // soft delete via ativo=false
  const { error } = await supabase.from('publicacoes').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function uploadMuralImagem(condominioId: string, file: File): Promise<string> {
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

export async function getMuralImagemSignedUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error) {
    console.warn('[mural] signed URL erro:', error.message)
    return null
  }
  return data.signedUrl
}

// ============================================================
// Reacoes
// ============================================================

export async function listReacoes(publicacoesIds: string[]): Promise<Reacao[]> {
  if (publicacoesIds.length === 0) return []
  const { data, error } = await supabase
    .from('reacoes')
    .select('*')
    .in('publicacao_id', publicacoesIds)
  if (error) throw error
  return (data ?? []) as Reacao[]
}

export async function adicionarReacao(publicacao_id: string, user_id: string, tipo: TipoReacao = 'curtir'): Promise<void> {
  const { error } = await supabase
    .from('reacoes')
    .insert({ publicacao_id, user_id, tipo })
  if (error) throw error
}

export async function removerReacao(publicacao_id: string, user_id: string, tipo: TipoReacao = 'curtir'): Promise<void> {
  const { error } = await supabase
    .from('reacoes')
    .delete()
    .eq('publicacao_id', publicacao_id)
    .eq('user_id', user_id)
    .eq('tipo', tipo)
  if (error) throw error
}
