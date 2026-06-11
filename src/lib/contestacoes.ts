import { supabase } from './supabase'
import type { Contestacao, AutorTipo } from '../types/contestacao'

/** Alvo da contestação: uma multa OU uma notificação. */
export type AlvoContestacao = { multa_id: string } | { notificacao_id: string }

function colVal(alvo: AlvoContestacao): { col: 'multa_id' | 'notificacao_id'; val: string } {
  return 'multa_id' in alvo
    ? { col: 'multa_id', val: alvo.multa_id }
    : { col: 'notificacao_id', val: alvo.notificacao_id }
}

export async function listContestacoes(alvo: AlvoContestacao): Promise<Contestacao[]> {
  const { col, val } = colVal(alvo)
  const { data, error } = await supabase
    .from('contestacoes')
    .select('*')
    .eq(col, val)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Contestacao[]
}

export async function postContestacao(
  alvo: AlvoContestacao,
  autor_id: string,
  autor_tipo: AutorTipo,
  mensagem: string,
): Promise<void> {
  const { col, val } = colVal(alvo)
  const { error } = await supabase
    .from('contestacoes')
    .insert({ [col]: val, autor_id, autor_tipo, mensagem: mensagem.trim() })
  if (error) throw error
}
