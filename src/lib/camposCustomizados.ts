import { supabase } from './supabase'

export type TipoCampo = 'text' | 'number' | 'boolean' | 'date' | 'select'
export type EntidadeCampo = 'unidade' | 'ocorrencia' | 'chamado' | 'pessoa'

export interface CampoCustomizado {
  id: string
  condominio_id: string
  entidade: EntidadeCampo
  nome: string
  label: string
  tipo: TipoCampo
  opcoes: string[] | null
  obrigatorio: boolean
  ordem: number
  created_at: string
}

export interface CampoCustomizadoInput {
  condominio_id: string
  entidade: EntidadeCampo
  nome: string
  label: string
  tipo: TipoCampo
  opcoes?: string[] | null
  obrigatorio?: boolean
  ordem?: number
}

export async function listCamposCustomizados(
  condominio_id: string,
  entidade?: EntidadeCampo,
): Promise<CampoCustomizado[]> {
  let q = supabase
    .from('campos_customizados')
    .select('*')
    .eq('condominio_id', condominio_id)
    .order('entidade')
    .order('ordem')
  if (entidade) q = q.eq('entidade', entidade)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CampoCustomizado[]
}

export async function createCampoCustomizado(input: CampoCustomizadoInput): Promise<CampoCustomizado> {
  const { data, error } = await supabase
    .from('campos_customizados')
    .insert({
      ...input,
      nome: input.nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      opcoes: input.opcoes ?? null,
      obrigatorio: input.obrigatorio ?? false,
      ordem: input.ordem ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CampoCustomizado
}

export async function deleteCampoCustomizado(id: string): Promise<void> {
  const { error } = await supabase.from('campos_customizados').delete().eq('id', id)
  if (error) throw error
}

export async function updateCampoCustomizado(
  id: string,
  patch: Partial<Pick<CampoCustomizado, 'label' | 'obrigatorio' | 'ordem' | 'opcoes'>>,
): Promise<void> {
  const { error } = await supabase.from('campos_customizados').update(patch).eq('id', id)
  if (error) throw error
}
