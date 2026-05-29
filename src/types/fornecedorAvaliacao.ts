export interface FornecedorAvaliacao {
  id: string
  fornecedor_id: string
  condominio_id: string
  user_id: string
  estrelas: number
  comentario: string | null
  created_at: string
  updated_at: string
}

export interface FornecedorAvaliacaoInput {
  fornecedor_id: string
  condominio_id: string
  estrelas: number
  comentario?: string | null
}

export interface AgregadoAvaliacao {
  media: number
  total: number
}
