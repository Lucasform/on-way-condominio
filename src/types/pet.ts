export type EspeciePet = 'cao' | 'gato' | 'ave' | 'outro'
export type PortePet = 'pequeno' | 'medio' | 'grande' | null

export interface Pet {
  id: string
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  nome: string
  especie: EspeciePet
  raca: string | null
  porte: PortePet
  foto_url: string | null
  vacinacao_em_dia: boolean
  data_vacina_antirabica: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type PetInput = Omit<Pet, 'id' | 'ativo' | 'created_at' | 'updated_at'>

export interface PetCirculacao {
  id: string
  pet_id: string
  condominio_id: string
  area: string
  observado_em: string
  observador_id: string | null
  observacoes: string | null
}
