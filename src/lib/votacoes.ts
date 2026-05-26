import { supabase } from './supabase'
import type { Votacao, VotacaoOpcao, Voto, VotacaoInput, StatusVotacao } from '../types/votacao'

export async function listVotacoes(opts: { condominio_id?: string; status?: StatusVotacao } = {}): Promise<Votacao[]> {
  let q = supabase
    .from('votacoes')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Votacao[]
}

export async function getVotacao(id: string): Promise<{ votacao: Votacao; opcoes: VotacaoOpcao[]; votos: Voto[] } | null> {
  const { data: v, error: vErr } = await supabase.from('votacoes').select('*').eq('id', id).maybeSingle()
  if (vErr) throw vErr
  if (!v) return null
  const [{ data: opcoes }, { data: votos }] = await Promise.all([
    supabase.from('votacao_opcoes').select('*').eq('votacao_id', id).order('ordem'),
    supabase.from('votos').select('*').eq('votacao_id', id),
  ])
  return {
    votacao: v as Votacao,
    opcoes: (opcoes ?? []) as VotacaoOpcao[],
    votos: (votos ?? []) as Voto[],
  }
}

export async function createVotacao(input: VotacaoInput): Promise<Votacao> {
  const { data: v, error: vErr } = await supabase
    .from('votacoes')
    .insert({
      condominio_id: input.condominio_id,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim || null,
    })
    .select('*')
    .single()
  if (vErr) throw vErr

  const opcoes = input.opcoes.map((texto, ordem) => ({
    votacao_id: (v as Votacao).id,
    texto: texto.trim(),
    ordem,
  }))
  const { error: oErr } = await supabase.from('votacao_opcoes').insert(opcoes)
  if (oErr) throw oErr

  return v as Votacao
}

export async function encerrarVotacao(id: string): Promise<void> {
  const { error } = await supabase.from('votacoes').update({ status: 'encerrada' }).eq('id', id)
  if (error) throw error
}

export async function cancelarVotacao(id: string): Promise<void> {
  const { error } = await supabase.from('votacoes').update({ status: 'cancelada' }).eq('id', id)
  if (error) throw error
}

export async function votar(votacao_id: string, opcao_id: string, user_id: string): Promise<void> {
  // Tenta INSERT; se já existir voto, faz UPDATE pra mudar a opção
  const { error } = await supabase
    .from('votos')
    .upsert(
      { votacao_id, opcao_id, user_id },
      { onConflict: 'votacao_id,user_id' },
    )
  if (error) throw error
}

export async function removerVoto(votacao_id: string, user_id: string): Promise<void> {
  const { error } = await supabase
    .from('votos')
    .delete()
    .eq('votacao_id', votacao_id)
    .eq('user_id', user_id)
  if (error) throw error
}

export async function deleteVotacao(id: string): Promise<void> {
  const { error } = await supabase.from('votacoes').delete().eq('id', id)
  if (error) throw error
}
