import { supabase } from './supabase'
import type { Contestacao, AutorTipo } from '../types/contestacao'

export async function listContestacoes(multaId: string): Promise<Contestacao[]> {
  const { data, error } = await supabase
    .from('contestacoes')
    .select('*')
    .eq('multa_id', multaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Contestacao[]
}

export async function postContestacao(
  multa_id: string,
  autor_id: string,
  autor_tipo: AutorTipo,
  mensagem: string,
): Promise<void> {
  const { error } = await supabase
    .from('contestacoes')
    .insert({ multa_id, autor_id, autor_tipo, mensagem: mensagem.trim() })
  if (error) throw error
}
