import { supabase } from './supabase'
import type { Pessoa, PessoaInput } from '../types/pessoa'

export async function listPessoas(opts: { condominio_id?: string; ativo?: boolean } = {}): Promise<Pessoa[]> {
  let q = supabase
    .from('pessoas')
    .select('*')
    .order('nome', { ascending: true })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Pessoa[]
}

export async function getPessoa(id: string): Promise<Pessoa | null> {
  const { data, error } = await supabase
    .from('pessoas')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Pessoa | null
}

export async function createPessoa(input: PessoaInput): Promise<Pessoa> {
  const { data, error } = await supabase
    .from('pessoas')
    .insert(normalize(input))
    .select('*')
    .single()
  if (error) throw error
  return data as Pessoa
}

export async function excluirUsuarioAuth(user_id: string, motivo?: string): Promise<{ email_enviado: boolean }> {
  const { data, error } = await supabase.functions.invoke('delete-user-account', {
    body: { user_id, motivo: motivo ?? null },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { email_enviado: !!data?.email_enviado }
}

export async function updatePessoa(id: string, input: PessoaInput): Promise<Pessoa> {
  const { data, error } = await supabase
    .from('pessoas')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Pessoa
}

export async function deletePessoa(id: string): Promise<void> {
  const { error } = await supabase.from('pessoas').delete().eq('id', id)
  if (error) throw error
}

export async function setPessoaAtivo(id: string, ativo: boolean): Promise<{ ok: boolean; auth_synced?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('set-pessoa-ativo', {
    body: { pessoa_id: id, ativo },
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, auth_synced: data?.auth_synced }
}

export async function convidarPessoa(
  pessoa_id: string,
  role: 'morador' | 'portaria' | 'ronda' | 'sindico' | 'subsindico' | 'conselheiro' | 'administradora' = 'morador',
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('invite-pessoa', {
    body: { pessoa_id, role },
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, email: data?.email }
}

export async function resetSenhaUsuario(pessoa_id: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('reset-senha-usuario', { body: { pessoa_id } })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, email: data?.email }
}

function normalize(input: PessoaInput): PessoaInput {
  return {
    condominio_id: input.condominio_id,
    unidade_id: input.unidade_id || null,
    nome: input.nome.trim(),
    cpf: digitsOrNull(input.cpf),
    email: trimOrNull(input.email),
    telefone: digitsOrNull(input.telefone),
    data_nascimento: input.data_nascimento || null,
    tipo_vinculo: input.tipo_vinculo,
    relacao_unidade: input.relacao_unidade,
    setor: trimOrNull(input.setor),
    foto_url: trimOrNull(input.foto_url),
  }
}

function trimOrNull(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}

function digitsOrNull(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  return d.length ? d : null
}
