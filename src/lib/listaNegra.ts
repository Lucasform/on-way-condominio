import { supabase } from './supabase'
import type { ListaNegraInput, ListaNegraItem } from '../types/listaNegra'

function digits(v: string | null | undefined): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  return d.length ? d : null
}

export async function listListaNegra(condominio_id: string): Promise<ListaNegraItem[]> {
  const { data, error } = await supabase
    .from('condominio_lista_negra')
    .select('*')
    .eq('condominio_id', condominio_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ListaNegraItem[]
}

export async function createListaNegra(input: ListaNegraInput): Promise<ListaNegraItem> {
  const { data: userData } = await supabase.auth.getUser()
  const registrado_por = userData.user?.id ?? null
  const { data, error } = await supabase
    .from('condominio_lista_negra')
    .insert({
      condominio_id: input.condominio_id,
      nome: input.nome.trim(),
      documento_tipo: input.documento_tipo ?? null,
      documento_numero: input.documento_numero?.trim() || null,
      motivo: input.motivo?.trim() || null,
      registrado_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ListaNegraItem
}

export async function setListaNegraAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('condominio_lista_negra')
    .update({ ativo })
    .eq('id', id)
  if (error) throw error
}

export async function deleteListaNegra(id: string): Promise<void> {
  const { error } = await supabase.from('condominio_lista_negra').delete().eq('id', id)
  if (error) throw error
}

/**
 * Verifica no client se a pessoa pelo nome/documento está barrada.
 * Usa a função SQL `esta_na_lista_negra` (security definer).
 */
export async function verificarBloqueio(input: {
  condominio_id: string
  documento_numero: string | null
  nome: string
}): Promise<boolean> {
  const docDigits = digits(input.documento_numero)
  const { data, error } = await supabase.rpc('esta_na_lista_negra', {
    p_condominio: input.condominio_id,
    p_documento: docDigits,
    p_nome: input.nome.trim(),
  })
  if (error) {
    console.warn('[listaNegra] verificarBloqueio falhou:', error.message)
    return false
  }
  return Boolean(data)
}
