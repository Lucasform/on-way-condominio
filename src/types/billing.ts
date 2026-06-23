import type { FeatureKey } from './featureFlag'

export type PlanoId = 'basico' | 'profissional' | 'enterprise' | 'custom'
export type AssinaturaStatus = 'trial' | 'ativo' | 'inadimplente' | 'cancelado'

export interface Assinatura {
  id: string
  condominio_id: string
  plano_id: PlanoId | null
  status: AssinaturaStatus
  features_plano: FeatureKey[]
  features_extras: FeatureKey[]
  limite_unidades: number | null
  limite_staff: number | null
  storage_gb: number | null
  trial_ends_at: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface PlanoCatalog {
  id: PlanoId
  nome: string
  descricao: string
  preco_mensal: number | null   // null = sob consulta
  features: FeatureKey[]
  limite_unidades: number | null
  limite_staff: number | null
  storage_gb: number | null
  destaque?: boolean
}

/** Catálogo oficial de planos — fonte única de verdade para preços e features. */
export const PLANO_CATALOG: PlanoCatalog[] = [
  {
    id: 'basico',
    nome: 'Starter',
    descricao: 'Essencial para condomínios pequenos que querem portaria digital.',
    preco_mensal: 149,
    features: ['portaria', 'acessos', 'moradores', 'mural', 'ocorrencias'],
    limite_unidades: 30,
    limite_staff: 2,
    storage_gb: 1,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    descricao: 'Comunicação completa + gestão operacional. Substitui grupos de WhatsApp e planilhas.',
    preco_mensal: 269,
    features: [
      'portaria', 'acessos', 'moradores', 'mural', 'ocorrencias',
      'chat', 'comunicados', 'classificados', 'multas', 'chamados', 'calendario',
    ],
    limite_unidades: 150,
    limite_staff: 5,
    storage_gb: 10,
    destaque: true,
  },
  {
    id: 'enterprise',
    nome: 'Completo',
    descricao: 'Tudo incluído: assembleias digitais, relatórios e integrações. Para administradoras.',
    preco_mensal: 509,
    features: [
      'portaria', 'acessos', 'moradores', 'mural', 'ocorrencias',
      'chat', 'comunicados', 'classificados', 'multas', 'chamados', 'calendario',
      'assembleias', 'servicos', 'regimento', 'relatorios', 'whatsapp',
    ],
    limite_unidades: null,
    limite_staff: null,
    storage_gb: 50,
  },
  {
    id: 'custom',
    nome: 'Personalizado',
    descricao: 'Monte seu plano escolhendo apenas as funcionalidades que precisa.',
    preco_mensal: null,
    features: [],
    limite_unidades: null,
    limite_staff: null,
    storage_gb: null,
  },
]

/** Preço unitário mensal por feature — usado no plano à la carte. */
export const FEATURE_PRICE: Partial<Record<FeatureKey, number>> = {
  portaria:      32,
  acessos:       20,
  moradores:     20,
  mural:         17,
  ocorrencias:   17,
  chat:          25,
  comunicados:   25,
  classificados: 20,
  multas:        20,
  chamados:      20,
  calendario:    17,
  assembleias:   42,
  servicos:      20,
  regimento:     17,
  relatorios:    30,
  whatsapp:      59,
  reservas:      34,
}

export const FEATURE_PRICE_MIN_QTD = 5
