import { supabase } from './supabase'
import type { Assinatura, PlanoId } from '../types/billing'
import type { FeatureKey } from '../types/featureFlag'

/**
 * Busca a assinatura de um condomínio.
 * @param condominio_id UUID do condomínio
 * @returns Assinatura encontrada ou `null` se ainda não existir
 * @throws Erro do Supabase em caso de falha na consulta
 */
export async function getAssinatura(condominio_id: string): Promise<Assinatura | null> {
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('condominio_id', condominio_id)
    .maybeSingle()
  if (error) throw error
  return data as Assinatura | null
}

/**
 * Lista todas as assinaturas da plataforma, ordenadas por data de criação (mais recente primeiro).
 * @returns Array de assinaturas (vazio se não houver nenhuma)
 * @throws Erro do Supabase em caso de falha na consulta
 */
export async function listAssinaturas(): Promise<Assinatura[]> {
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Assinatura[]
}

/**
 * Atualiza campos da assinatura de um condomínio.
 * @param condominio_id UUID do condomínio
 * @param patch Campos a atualizar (qualquer subconjunto dos campos permitidos)
 * @throws Erro do Supabase em caso de falha na operação
 */
export async function updateAssinatura(
  condominio_id: string,
  patch: Partial<Pick<Assinatura,
    | 'plano_id' | 'status' | 'features_plano' | 'features_extras'
    | 'limite_unidades' | 'limite_staff' | 'storage_gb'
    | 'trial_ends_at' | 'periodo_inicio' | 'periodo_fim'
    | 'stripe_customer_id' | 'stripe_subscription_id'
  >>
): Promise<void> {
  const { error } = await supabase
    .from('assinaturas')
    .update(patch)
    .eq('condominio_id', condominio_id)
  if (error) throw error
}

/**
 * Ativa um plano para um condomínio. Chamado pelo webhook do Stripe ou manualmente pelo admin.
 * Define o status como "ativo", grava as features do plano e dados opcionais de limites e Stripe.
 * @param condominio_id UUID do condomínio
 * @param plano_id Identificador do plano contratado
 * @param features_plano Lista de features incluídas no plano
 * @param opts Dados adicionais: features extras, limites de unidades/staff/storage e IDs Stripe
 * @throws Erro do Supabase em caso de falha na operação
 */
export async function ativarPlano(
  condominio_id: string,
  plano_id: PlanoId,
  features_plano: FeatureKey[],
  opts?: {
    features_extras?: FeatureKey[]
    limite_unidades?: number | null
    limite_staff?: number | null
    storage_gb?: number | null
    stripe_customer_id?: string
    stripe_subscription_id?: string
  }
): Promise<void> {
  await updateAssinatura(condominio_id, {
    plano_id,
    status: 'ativo',
    features_plano,
    features_extras: opts?.features_extras ?? [],
    limite_unidades: opts?.limite_unidades ?? null,
    limite_staff: opts?.limite_staff ?? null,
    storage_gb: opts?.storage_gb ?? null,
    periodo_inicio: new Date().toISOString(),
    stripe_customer_id: opts?.stripe_customer_id,
    stripe_subscription_id: opts?.stripe_subscription_id,
  })
}

/**
 * Retorna o conjunto de features efetivamente disponíveis para um condomínio.
 *
 * Regras de resolução:
 * - `null` ou `trial` → todas as features globalmente ativas
 * - `ativo` → union de `features_plano` + `features_extras`
 * - `inadimplente` / `cancelado` → conjunto vazio (acesso bloqueado)
 *
 * @param assinatura Assinatura atual do condomínio (null tratado como trial)
 * @param featuresGlobais Lista de features habilitadas na plataforma
 * @returns Set de feature keys disponíveis para o condomínio
 */
export function resolverFeaturesDisponiveis(
  assinatura: Assinatura | null,
  featuresGlobais: FeatureKey[],
): Set<FeatureKey> {
  if (!assinatura || assinatura.status === 'trial') {
    return new Set(featuresGlobais)
  }
  if (assinatura.status === 'ativo') {
    return new Set([...assinatura.features_plano, ...assinatura.features_extras])
  }
  return new Set()
}
