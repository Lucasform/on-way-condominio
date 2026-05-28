import { supabase } from './supabase'

export type CargoDiretoria = 'sindico' | 'subsindico' | 'conselheiro' | 'administradora'

export interface Mandato {
  id: string
  condominio_id: string
  perfil_id: string
  cargo: CargoDiretoria
  data_inicio: string
  data_fim: string | null
  ativo: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface MandatoInput {
  condominio_id: string
  perfil_id: string
  cargo: CargoDiretoria
  data_inicio: string
  data_fim?: string | null
  observacoes?: string | null
}

const SELECT = 'id, condominio_id, perfil_id, cargo, data_inicio, data_fim, ativo, observacoes, created_at, updated_at'

export async function listMandatos(opts: { condominio_id?: string; apenas_ativos?: boolean } = {}): Promise<Mandato[]> {
  let q = supabase
    .from('diretoria_mandatos')
    .select(SELECT)
    .order('data_inicio', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.apenas_ativos !== false) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Mandato[]
}

export async function createMandato(input: MandatoInput): Promise<Mandato> {
  const { data, error } = await supabase
    .from('diretoria_mandatos')
    .insert({
      ...input,
      observacoes: input.observacoes?.trim() || null,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as Mandato
}

export async function updateMandato(id: string, patch: Partial<MandatoInput> & { ativo?: boolean }): Promise<void> {
  const { error } = await supabase.from('diretoria_mandatos').update(patch).eq('id', id)
  if (error) throw error
}

export async function encerrarMandato(id: string, data_fim?: string): Promise<void> {
  const fim = data_fim ?? new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('diretoria_mandatos')
    .update({ ativo: false, data_fim: fim })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMandato(id: string): Promise<void> {
  const { error } = await supabase.from('diretoria_mandatos').delete().eq('id', id)
  if (error) throw error
}

/**
 * Retorna mandatos cujo data_fim cai nos proximos `dias` dias. Util pra
 * mostrar alerta "vencendo em breve".
 */
export function mandatosVencendoEm(mandatos: Mandato[], dias: number): Mandato[] {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const limite = new Date(hoje.getTime() + dias * 86400_000)
  return mandatos.filter((m) => {
    if (!m.ativo || !m.data_fim) return false
    const fim = new Date(m.data_fim + 'T00:00:00')
    return fim >= hoje && fim <= limite
  })
}
