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

export async function setPessoaAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('pessoas').update({ ativo }).eq('id', id)
  if (error) throw error
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
