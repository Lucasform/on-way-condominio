export type TipoVeiculo = 'carro' | 'moto' | 'bicicleta' | 'utilitario' | 'outro'

export interface Veiculo {
  id: string
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  placa: string
  modelo: string | null
  cor: string | null
  tipo: TipoVeiculo
  vaga: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type VeiculoInput = Omit<Veiculo, 'id' | 'ativo' | 'created_at' | 'updated_at'>
