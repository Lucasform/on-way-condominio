import { supabase } from './supabase'

export type ImportTipo = 'pessoas' | 'unidades' | 'veiculos' | 'prestadores'

export interface ImportBatch {
  id: string
  condominio_id: string
  user_id: string | null
  tipo: ImportTipo
  total_criados: number
  desfeito_em: string | null
  created_at: string
}

/**
 * Cria um registro de batch (chamar ANTES do INSERT em massa, usar o id
 * retornado em todos os rows como `import_batch_id`).
 */
export async function criarImportBatch(input: {
  condominio_id: string
  user_id: string
  tipo: ImportTipo
}): Promise<string> {
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      condominio_id: input.condominio_id,
      user_id: input.user_id,
      tipo: input.tipo,
      total_criados: 0,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function setImportBatchTotal(batch_id: string, total: number): Promise<void> {
  const { error } = await supabase
    .from('import_batches')
    .update({ total_criados: total })
    .eq('id', batch_id)
  if (error) throw error
}

/** Ultimo batch do usuario num condominio, por tipo, ainda nao desfeito. */
export async function getUltimoBatchUsuario(opts: {
  condominio_id: string
  user_id: string
  tipo: ImportTipo
}): Promise<ImportBatch | null> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('condominio_id', opts.condominio_id)
    .eq('user_id', opts.user_id)
    .eq('tipo', opts.tipo)
    .is('desfeito_em', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as ImportBatch | null) ?? null
}

/**
 * Apaga todos os registros de uma tabela com import_batch_id == batch.id
 * e marca o batch como desfeito. Operacao destrutiva — confirmar na UI.
 */
export async function desfazerImportBatch(batch: ImportBatch): Promise<number> {
  const { count, error } = await supabase
    .from(batch.tipo)
    .delete({ count: 'exact' })
    .eq('import_batch_id', batch.id)
  if (error) throw error
  await supabase
    .from('import_batches')
    .update({ desfeito_em: new Date().toISOString() })
    .eq('id', batch.id)
  return count ?? 0
}
