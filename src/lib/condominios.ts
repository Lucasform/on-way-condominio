import { supabase } from './supabase'
import type { Condominio, CondominioInput } from '../types/condominio'

export async function listCondominios(opts: { ativo?: boolean } = {}): Promise<Condominio[]> {
  let q = supabase.from('condominios').select('*').order('nome', { ascending: true })
  if (opts.ativo !== undefined) q = q.eq('ativo', opts.ativo)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Condominio[]
}

export async function getCondominio(id: string): Promise<Condominio | null> {
  const { data, error } = await supabase
    .from('condominios')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Condominio | null
}

export async function createCondominio(input: CondominioInput): Promise<Condominio> {
  const { data, error } = await supabase
    .from('condominios')
    .insert(normalize(input))
    .select('*')
    .single()
  if (error) throw error
  return data as Condominio
}

export async function updateCondominio(id: string, input: CondominioInput): Promise<Condominio> {
  const { data, error } = await supabase
    .from('condominios')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Condominio
}

export async function setCondominioAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('condominios').update({ ativo }).eq('id', id)
  if (error) throw error
}

// Hard delete — cascade apaga todos os filhos (unidades, ocorrências, multas, etc).
// RLS permite só admin_onway.
export async function deleteCondominio(id: string): Promise<void> {
  const { error } = await supabase.from('condominios').delete().eq('id', id)
  if (error) throw error
}

function normalize(input: CondominioInput): CondominioInput {
  return {
    nome: input.nome.trim(),
    cnpj: digitsOrNull(input.cnpj),
    endereco: trimOrNull(input.endereco),
    bairro: trimOrNull(input.bairro),
    cidade: trimOrNull(input.cidade),
    estado: input.estado ? input.estado.toUpperCase().slice(0, 2) : null,
    cep: digitsOrNull(input.cep),
    administradora: trimOrNull(input.administradora),
    logo_url: trimOrNull(input.logo_url),
    regimento_pdf_url: input.regimento_pdf_url ?? null,
    modelo_notificacao_url: input.modelo_notificacao_url ?? null,
    modelo_notificacao_texto: input.modelo_notificacao_texto ?? null,
    ai_instrucoes: input.ai_instrucoes ?? null,
    plano: input.plano,
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
