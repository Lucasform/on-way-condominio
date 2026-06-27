import { supabase } from './supabase'

/**
 * Retorna se o "launch mode" da plataforma está ativo.
 * Quando ativo, novos condomínios podem se cadastrar livremente (modo de lançamento público).
 * @returns `true` se launch_mode estiver ativo, `false` caso contrário ou se a config não existir
 */
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
