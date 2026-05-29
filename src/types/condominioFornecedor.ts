export type TipoFornecedor =
  | 'prestador'
  | 'diarista'
  | 'jardineiro'
  | 'manutencao'
  | 'pintor'
  | 'eletricista'
  | 'encanador'
  | 'feirante'
  | 'entregador'
  | 'outro'

export type StatusFornecedor = 'pendente' | 'aprovado' | 'inativo' | 'recusado'

export interface FornecedorAgenda {
  dias?: string[]      // ['seg','ter','qua','qui','sex','sab','dom']
  horario?: string     // 'HH:MM-HH:MM'
  ponto?: string       // local interno do condo (ex.: rua de feira)
}

export interface CondominioFornecedor {
  id: string
  condominio_id: string
  nome: string
  tipo: TipoFornecedor
  servico: string | null
  telefone: string | null
  email: string | null
  documento: string | null
  foto_url: string | null
  agenda: FornecedorAgenda | null
  cadastrado_por: string | null
  unidade_id: string | null
  status: StatusFornecedor
  aprovado_por: string | null
  aprovado_em: string | null
  motivo_recusa: string | null
  publico: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface CondominioFornecedorInput {
  condominio_id: string
  nome: string
  tipo: TipoFornecedor
  servico?: string | null
  telefone?: string | null
  email?: string | null
  documento?: string | null
  foto_url?: string | null
  agenda?: FornecedorAgenda | null
  unidade_id?: string | null
  observacoes?: string | null
}
