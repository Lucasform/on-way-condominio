import { supabase } from './supabase'
import type { RegimentoArtigo } from '../types/regimento'

export interface RegimentoVersao {
  id: string
  condominio_id: string
  versao_num: number
  motivo: string | null
  snapshot: RegimentoArtigo[]
  total_artigos: number
  criado_por: string | null
  created_at: string
}

const SELECT = 'id, condominio_id, versao_num, motivo, snapshot, total_artigos, criado_por, created_at'

export async function listVersoes(condominio_id: string): Promise<RegimentoVersao[]> {
  const { data, error } = await supabase
    .from('regimento_versoes')
    .select(SELECT)
    .eq('condominio_id', condominio_id)
    .order('versao_num', { ascending: false })
  if (error) throw error
  return (data ?? []) as RegimentoVersao[]
}

export async function getVersao(id: string): Promise<RegimentoVersao | null> {
  const { data, error } = await supabase
    .from('regimento_versoes')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as RegimentoVersao | null
}

/**
 * Captura snapshot do regimento atual e grava como nova versao.
 * Numero da versao = max + 1 por condominio. Use antes de mudancas significativas.
 */
export async function criarSnapshot(opts: {
  condominio_id: string
  motivo?: string
  user_id?: string | null
}): Promise<RegimentoVersao> {
  const { data: artigos, error: aErr } = await supabase
    .from('regimento_artigos')
    .select('*')
    .eq('condominio_id', opts.condominio_id)
    .order('ordem')
  if (aErr) throw aErr

  const { data: ultima } = await supabase
    .from('regimento_versoes')
    .select('versao_num')
    .eq('condominio_id', opts.condominio_id)
    .order('versao_num', { ascending: false })
    .limit(1)
    .maybeSingle()
  const proximaVersao = (ultima?.versao_num ?? 0) + 1

  const { data, error } = await supabase
    .from('regimento_versoes')
    .insert({
      condominio_id: opts.condominio_id,
      versao_num: proximaVersao,
      motivo: opts.motivo?.trim() || null,
      snapshot: artigos ?? [],
      total_artigos: (artigos ?? []).length,
      criado_por: opts.user_id ?? null,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as RegimentoVersao
}

/** Versao mais recente; null se nunca houve snapshot. */
export async function getVersaoAtual(condominio_id: string): Promise<RegimentoVersao | null> {
  const { data, error } = await supabase
    .from('regimento_versoes')
    .select(SELECT)
    .eq('condominio_id', condominio_id)
    .order('versao_num', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as RegimentoVersao | null
}
