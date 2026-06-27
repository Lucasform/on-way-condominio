import { supabase } from './supabase'
import type { FeatureKey } from '../types/featureFlag'

export interface CondoFeatureOverride {
  id: string
  condominio_id: string
  key: FeatureKey
  ativo: boolean
  updated_at: string
  updated_by: string | null
}

export async function listCondoFeatureOverrides(condominio_id: string): Promise<CondoFeatureOverride[]> {
  const { data, error } = await supabase
    .from('condo_feature_overrides')
    .select('*')
    .eq('condominio_id', condominio_id)
  if (error) throw error
  return (data ?? []) as CondoFeatureOverride[]
}

export async function upsertCondoFeatureOverride(
  condominio_id: string,
  key: FeatureKey,
  ativo: boolean,
  updated_by: string,
): Promise<void> {
  const { error } = await supabase
    .from('condo_feature_overrides')
    .upsert({ condominio_id, key, ativo, updated_by, updated_at: new Date().toISOString() }, {
      onConflict: 'condominio_id,key',
    })
  if (error) throw error
}
