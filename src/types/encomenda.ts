export type TipoEncomenda = 'encomenda' | 'comida' | 'documento' | 'outro'
export type StatusEncomenda = 'aguardando' | 'entregue' | 'devolvida'

export interface Encomenda {
  id: string
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  tipo: TipoEncomenda
  transportadora: string | null
  codigo_rastreio: string | null
  descricao: string | null
  local_armazenamento: string | null
  foto_url: string | null
  observacoes: string | null
  codigo_retirada: string | null
  recebido_por: string
  entregue_em: string | null
  entregue_para: string | null
  entregue_por: string | null
  status: StatusEncomenda
  created_at: string
  updated_at: string
}

export interface EncomendaInput {
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  tipo: TipoEncomenda
  transportadora: string | null
  codigo_rastreio: string | null
  descricao: string | null
  local_armazenamento: string | null
  foto_url: string | null
  observacoes: string | null
}
