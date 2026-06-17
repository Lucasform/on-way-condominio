import { supabase } from './supabase'
import type {
  Solicitacao,
  SolicitacaoInput,
  SolicitacaoMensagem,
  StatusSolicitacao,
} from '../types/solicitacao'

export async function listSolicitacoes(opts: {
  condominio_id?: string
  autor_id?: string
  status?: StatusSolicitacao
} = {}): Promise<Solicitacao[]> {
  let q = supabase
    .from('solicitacoes')
    .select(`
      *,
      autor:perfis!solicitacoes_autor_id_fkey(nome_exibicao),
      unidade:unidades!solicitacoes_unidade_id_fkey(nome)
    `)
    .order('updated_at', { ascending: false })

  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.autor_id) q = q.eq('autor_id', opts.autor_id)
  if (opts.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>
    return {
      ...(r as unknown as Solicitacao),
      autor_nome: (r.autor as { nome_exibicao?: string } | null)?.nome_exibicao ?? null,
      unidade_nome: (r.unidade as { nome?: string } | null)?.nome ?? null,
    }
  })
}

export async function getSolicitacao(id: string): Promise<Solicitacao | null> {
  const { data, error } = await supabase
    .from('solicitacoes')
    .select(`
      *,
      autor:perfis!solicitacoes_autor_id_fkey(nome_exibicao),
      unidade:unidades!solicitacoes_unidade_id_fkey(nome)
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as Record<string, unknown>
  return {
    ...(row as unknown as Solicitacao),
    autor_nome: (row.autor as { nome_exibicao?: string } | null)?.nome_exibicao ?? null,
    unidade_nome: (row.unidade as { nome?: string } | null)?.nome ?? null,
  }
}

export async function createSolicitacao(
  input: SolicitacaoInput,
  autor_id: string,
): Promise<Solicitacao> {
  const { data, error } = await supabase
    .from('solicitacoes')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id ?? null,
      autor_id,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Solicitacao
}

export async function updateSolicitacaoStatus(
  id: string,
  status: StatusSolicitacao,
): Promise<void> {
  const { error } = await supabase
    .from('solicitacoes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
// Mensagens
// ============================================================

export async function listMensagens(solicitacao_id: string): Promise<SolicitacaoMensagem[]> {
  const { data, error } = await supabase
    .from('solicitacao_mensagens')
    .select(`
      *,
      autor:perfis!solicitacao_mensagens_autor_id_fkey(nome_exibicao, role)
    `)
    .eq('solicitacao_id', solicitacao_id)
    .order('criado_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>
    return {
      ...(r as unknown as SolicitacaoMensagem),
      autor_nome: (r.autor as { nome_exibicao?: string } | null)?.nome_exibicao ?? null,
      autor_role: (r.autor as { role?: string } | null)?.role ?? null,
    }
  })
}

export async function addMensagem(
  solicitacao_id: string,
  autor_id: string,
  texto: string,
): Promise<SolicitacaoMensagem> {
  const { data, error } = await supabase
    .from('solicitacao_mensagens')
    .insert({ solicitacao_id, autor_id, texto: texto.trim() })
    .select('*')
    .single()
  if (error) throw error

  // bump updated_at on solicitacao
  await supabase
    .from('solicitacoes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', solicitacao_id)

  return data as SolicitacaoMensagem
}
