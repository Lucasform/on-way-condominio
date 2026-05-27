export type StatusMulta =
  | 'em_analise'
  | 'aplicada'
  | 'paga'
  | 'contestada'
  | 'cancelada'
  | 'arquivada'

export interface Multa {
  id: string
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  ocorrencia_id: string | null
  aplicada_por: string
  valor: number
  artigo_regimento: string | null
  descricao: string
  status: StatusMulta
  data_aplicacao: string | null
  data_pagamento: string | null
  vencimento_em: string | null
  recibo_quitacao_url: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface MultaInput {
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  ocorrencia_id: string | null
  valor: number
  artigo_regimento: string | null
  descricao: string
  observacoes: string | null
  vencimento_em?: string | null
}

export interface MultaStatusLog {
  id: string
  multa_id: string
  status_anterior: StatusMulta | null
  status_novo: StatusMulta
  ator_id: string | null
  created_at: string
}
