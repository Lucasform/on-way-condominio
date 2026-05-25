export type TipoUnidade = 'apartamento' | 'casa' | 'sala' | 'loja' | 'outro'

export interface Unidade {
  id: string
  condominio_id: string
  bloco: string | null
  numero: string
  tipo: TipoUnidade
  area_m2: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type UnidadeInput = Omit<Unidade, 'id' | 'ativo' | 'created_at' | 'updated_at'>
