export type Plano = 'free' | 'pro' | 'enterprise'

export interface Condominio {
  id: string
  nome: string
  cnpj: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  administradora: string | null
  plano: Plano
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CondominioInput = Omit<Condominio, 'id' | 'ativo' | 'created_at' | 'updated_at'>
