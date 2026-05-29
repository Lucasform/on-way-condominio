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
/**
 * Exclusão definitiva via edge `delete-condominio`: apaga TODOS os usuários
 * (auth.users) vinculados ao condo e depois cascateia o condomínio (que
 * derruba unidades, pessoas, ocorrências, multas, chamados, encomendas,
 * comunicados, mural, calendário, assembleias, votações, chat). Restrito a
 * `admin_onway`. Não usa hard-delete direto pra garantir a limpeza dos users.
 */
export async function deleteCondominio(id: string): Promise<{
  users: number
  users_falhas: Array<{ id: string; erro: string }>
  condominio: string
}> {
  const { data, error } = await supabase.functions.invoke('delete-condominio', {
    body: { condominio_id: id },
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error ?? 'Falha na exclusão.')
  return data.deletados as {
    users: number
    users_falhas: Array<{ id: string; erro: string }>
    condominio: string
  }
}

/**
 * Conta o que será apagado em cascata, pra mostrar no modal de confirmação.
 */
export async function previewExclusaoCondominio(id: string): Promise<{
  unidades: number
  pessoas: number
  usuarios: number
  ocorrencias: number
  multas: number
  chamados: number
  comunicados: number
  publicacoes: number
}> {
  const counts = await Promise.all([
    supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('pessoas').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('perfis').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('ocorrencias').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('multas').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('chamados').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
    supabase.from('comunicados').select('*', { count: 'exact', head: true }).eq('condominio_id', id).then((r) => r, () => ({ count: 0 })),
    supabase.from('publicacoes').select('*', { count: 'exact', head: true }).eq('condominio_id', id),
  ])
  return {
    unidades: counts[0].count ?? 0,
    pessoas: counts[1].count ?? 0,
    usuarios: counts[2].count ?? 0,
    ocorrencias: counts[3].count ?? 0,
    multas: counts[4].count ?? 0,
    chamados: counts[5].count ?? 0,
    comunicados: counts[6].count ?? 0,
    publicacoes: counts[7].count ?? 0,
  }
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
    slug: trimOrNull(input.slug),
    cor_primaria: trimOrNull(input.cor_primaria),
    texto_login: trimOrNull(input.texto_login),
    imagem_login_url: trimOrNull(input.imagem_login_url),
    permite_signup: input.permite_signup ?? true,
    mensagem_boas_vindas: trimOrNull(input.mensagem_boas_vindas),
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
