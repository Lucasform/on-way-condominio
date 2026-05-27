import { supabase } from './supabase'
import type { RegimentoArtigo, RegimentoArtigoInput } from '../types/regimento'

export async function listRegimentoArtigos(opts: {
  condominio_id?: string
  ativo?: boolean
} = {}): Promise<RegimentoArtigo[]> {
  let q = supabase
    .from('regimento_artigos')
    .select('id,condominio_id,numero,titulo,conteudo,ordem,ativo,embedding_atualizado_em,created_at,updated_at')
    .order('ordem', { ascending: true })
    .order('numero', { ascending: true, nullsFirst: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as RegimentoArtigo[]
}

export async function getRegimentoArtigo(id: string): Promise<RegimentoArtigo | null> {
  const { data, error } = await supabase
    .from('regimento_artigos')
    .select('id,condominio_id,numero,titulo,conteudo,ordem,ativo,embedding_atualizado_em,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as RegimentoArtigo | null
}

export async function createRegimentoArtigo(input: RegimentoArtigoInput): Promise<RegimentoArtigo> {
  const { data, error } = await supabase
    .from('regimento_artigos')
    .insert(normalize(input))
    .select('id,condominio_id,numero,titulo,conteudo,ordem,ativo,embedding_atualizado_em,created_at,updated_at')
    .single()
  if (error) throw error
  return data as RegimentoArtigo
}

export async function updateRegimentoArtigo(id: string, input: RegimentoArtigoInput): Promise<RegimentoArtigo> {
  const { data, error } = await supabase
    .from('regimento_artigos')
    .update(normalize(input))
    .eq('id', id)
    .select('id,condominio_id,numero,titulo,conteudo,ordem,ativo,embedding_atualizado_em,created_at,updated_at')
    .single()
  if (error) throw error
  return data as RegimentoArtigo
}

export async function setRegimentoArtigoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('regimento_artigos').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deleteRegimentoArtigo(id: string): Promise<void> {
  const { error } = await supabase.from('regimento_artigos').delete().eq('id', id)
  if (error) throw error
}

export async function deleteRegimentoArtigosInativos(condominio_id?: string): Promise<number> {
  let q = supabase.from('regimento_artigos').delete({ count: 'exact' }).eq('ativo', false)
  if (condominio_id) q = q.eq('condominio_id', condominio_id)
  const { error, count } = await q
  if (error) throw error
  return count ?? 0
}

function normalize(input: RegimentoArtigoInput): RegimentoArtigoInput {
  return {
    condominio_id: input.condominio_id,
    numero: input.numero?.trim() || null,
    titulo: input.titulo.trim(),
    conteudo: input.conteudo.trim(),
    ordem: Number.isFinite(input.ordem) ? input.ordem : 0,
  }
}
