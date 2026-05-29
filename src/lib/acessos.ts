import { supabase } from './supabase'
import type {
  AcessoAutorizado,
  AcessoAutorizadoInput,
  AcessoEvento,
  StatusAcesso,
  TipoEventoAcesso,
} from '../types/acesso'

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length ? t : null
}

/**
 * Retorna ids de unidades vinculadas ao user logado (pessoas.user_id),
 * filtrando pelo condominio. Morador residencial costuma ter 1; admin/sindico
 * pode ter 0; alguns vínculos múltiplos (cônjuge em 2 unidades) podem dar N.
 */
export async function getMyUnidadeIds(condominio_id: string, user_id: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('pessoas')
    .select('unidade_id')
    .eq('user_id', user_id)
    .eq('condominio_id', condominio_id)
    .eq('ativo', true)
    .not('unidade_id', 'is', null)
  if (error) throw error
  const ids = new Set<string>()
  for (const row of (data ?? []) as Array<{ unidade_id: string | null }>) {
    if (row.unidade_id) ids.add(row.unidade_id)
  }
  return Array.from(ids)
}

// ============================================================
// CRUD acessos_autorizados
// ============================================================

export async function listAcessos(opts: {
  condominio_id?: string
  unidade_id?: string
  status?: StatusAcesso
  ativos_em?: string // ISO timestamp — filtra por vigencia
} = {}): Promise<AcessoAutorizado[]> {
  let q = supabase
    .from('acessos_autorizados')
    .select('*')
    .order('vigencia_inicio', { ascending: false })

  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.unidade_id) q = q.eq('unidade_id', opts.unidade_id)
  if (opts.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AcessoAutorizado[]
}

export async function getAcesso(id: string): Promise<AcessoAutorizado | null> {
  const { data, error } = await supabase
    .from('acessos_autorizados')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as AcessoAutorizado | null
}

export async function createAcesso(
  input: AcessoAutorizadoInput,
  criado_por: string,
): Promise<AcessoAutorizado> {
  const { data, error } = await supabase
    .from('acessos_autorizados')
    .insert({
      condominio_id: input.condominio_id,
      unidade_id: input.unidade_id,
      pessoa_id: input.pessoa_id ?? null,
      nome: input.nome.trim(),
      documento_tipo: input.documento_tipo ?? null,
      documento_numero: trimOrNull(input.documento_numero ?? null),
      telefone: trimOrNull(input.telefone ?? null),
      tipo: input.tipo,
      modalidade_vigencia: input.modalidade_vigencia ?? 'data',
      vigencia_inicio: input.vigencia_inicio ?? new Date().toISOString(),
      vigencia_fim: input.vigencia_fim ?? null,
      recorrencia: input.recorrencia ?? null,
      uso_unico: input.uso_unico ?? false,
      placa_veiculo: trimOrNull(input.placa_veiculo ?? null),
      acompanhantes_permitidos: input.acompanhantes_permitidos ?? 0,
      notificar_entrada: input.notificar_entrada ?? true,
      foto_url: trimOrNull(input.foto_url ?? null),
      observacao: trimOrNull(input.observacao ?? null),
      criado_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AcessoAutorizado
}

export async function updateAcesso(
  id: string,
  patch: Partial<AcessoAutorizadoInput> & { status?: StatusAcesso },
): Promise<AcessoAutorizado> {
  const upd: Record<string, unknown> = {}
  if (patch.nome !== undefined) upd.nome = patch.nome.trim()
  if (patch.documento_tipo !== undefined) upd.documento_tipo = patch.documento_tipo
  if (patch.documento_numero !== undefined) upd.documento_numero = trimOrNull(patch.documento_numero)
  if (patch.telefone !== undefined) upd.telefone = trimOrNull(patch.telefone)
  if (patch.tipo !== undefined) upd.tipo = patch.tipo
  if (patch.vigencia_inicio !== undefined) upd.vigencia_inicio = patch.vigencia_inicio
  if (patch.vigencia_fim !== undefined) upd.vigencia_fim = patch.vigencia_fim
  if (patch.observacao !== undefined) upd.observacao = trimOrNull(patch.observacao)
  if (patch.status !== undefined) upd.status = patch.status
  const { data, error } = await supabase
    .from('acessos_autorizados')
    .update(upd)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as AcessoAutorizado
}

export async function deleteAcesso(id: string): Promise<void> {
  const { error } = await supabase.from('acessos_autorizados').delete().eq('id', id)
  if (error) throw error
}

export async function revogarAcesso(
  id: string,
  condominio_id: string,
  registrado_por: string,
  motivo?: string,
): Promise<void> {
  await registrarEvento({
    acesso_id: id,
    condominio_id,
    tipo: 'revogada',
    registrado_por,
    motivo: motivo ?? null,
  })
}

// ============================================================
// Eventos (entrada / saida / negada / revogada)
// ============================================================

export async function listEventos(acesso_id: string): Promise<AcessoEvento[]> {
  const { data, error } = await supabase
    .from('acesso_eventos')
    .select('*')
    .eq('acesso_id', acesso_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AcessoEvento[]
}

export async function registrarEvento(input: {
  acesso_id: string
  condominio_id: string
  tipo: TipoEventoAcesso
  registrado_por: string
  motivo?: string | null
}): Promise<AcessoEvento> {
  const { data, error } = await supabase
    .from('acesso_eventos')
    .insert({
      acesso_id: input.acesso_id,
      condominio_id: input.condominio_id,
      tipo: input.tipo,
      registrado_por: input.registrado_por,
      motivo: input.motivo ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AcessoEvento
}
