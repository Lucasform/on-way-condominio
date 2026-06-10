import { supabase } from './supabase'

/**
 * Resolve nomes legíveis a partir de user_ids (auth.users.id == perfis.id).
 * Prioriza o nome da pessoa (cadastro residencial); cai no nome_exibicao do
 * perfil. Retorna um mapa user_id -> nome. Falhas viram fallback genérico.
 */
export async function resolveNomesUsuarios(userIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const out: Record<string, string> = {}
  try {
    const [{ data: perfis }, { data: pessoas }] = await Promise.all([
      supabase.from('perfis').select('id, nome_exibicao').in('id', ids),
      supabase.from('pessoas').select('user_id, nome').in('user_id', ids),
    ])
    for (const p of perfis ?? []) {
      if (p.nome_exibicao) out[p.id] = p.nome_exibicao
    }
    for (const p of pessoas ?? []) {
      if (p.user_id && p.nome) out[p.user_id] = p.nome
    }
  } catch { /* fallback abaixo */ }
  for (const id of ids) if (!out[id]) out[id] = 'Morador'
  return out
}
