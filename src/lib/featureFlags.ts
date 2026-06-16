import { supabase } from './supabase'
import type { FeatureFlag, FeatureKey } from '../types/featureFlag'

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key,nome,descricao,ativo,updated_at')
    .order('key')
  if (error) throw error
  return (data ?? []) as FeatureFlag[]
}

export async function updateFeatureFlag(key: FeatureKey, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('feature_flags')
    .update({ ativo })
    .eq('key', key)
  if (error) throw error
}
