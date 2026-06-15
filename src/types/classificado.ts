export type CategoriaClassificado =
  | 'eletronicos'
  | 'moveis'
  | 'roupas'
  | 'servicos'
  | 'imoveis'
  | 'outros'

export type StatusClassificado = 'ativo' | 'vendido' | 'cancelado'

export const CATEGORIA_LABEL: Record<CategoriaClassificado, string> = {
  eletronicos: 'Eletrônicos',
  moveis: 'Móveis',
  roupas: 'Roupas',
  servicos: 'Serviços',
  imoveis: 'Imóveis',
  outros: 'Outros',
}

export const CATEGORIA_EMOJI: Record<CategoriaClassificado, string> = {
  eletronicos: '📱',
  moveis: '🪑',
  roupas: '👕',
  servicos: '🔧',
  imoveis: '🏠',
  outros: '📦',
}

export interface Classificado {
  id: string
  condominio_id: string
  criado_por: string | null
  titulo: string
  descricao: string | null
  categoria: CategoriaClassificado
  preco: number | null
  fotos: string[]
  status: StatusClassificado
  link_externo: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ClassificadoInput {
  condominio_id: string
  titulo: string
  descricao?: string | null
  categoria: CategoriaClassificado
  preco?: number | null
  fotos?: string[]
  link_externo?: string | null
}
