import { supabase } from './supabase'

export async function getLaunchMode(): Promise<boolean> {
  const { data } = await supabase
    .from('plataforma_config')
    .select('valor')
    .eq('key', 'launch_mode')
    .maybeSingle()
  return data?.valor === true
}

export async function setLaunchMode(ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('plataforma_config')
    .upsert({ key: 'launch_mode', valor: ativo, updated_at: new Date().toISOString() })
  if (error) throw error
}
