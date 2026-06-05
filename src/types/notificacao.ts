export type StatusNotificacao =
  | 'pendente'
  | 'enviada'
  | 'ciente'
  | 'contestada'
  | 'advertencia'
  | 'multa_gerada'
  | 'arquivada'
  | 'cancelada'

export interface Notificacao {
  id: string
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  ocorrencia_id: string | null
  emitida_por: string
  assunto: string
  descricao: string
  artigo_regimento: string | null
  observacoes: string | null
  status: StatusNotificacao
  multa_id: string | null
  data_envio: string | null
  data_ciencia: string | null
  created_at: string
  updated_at: string
}

export interface NotificacaoInput {
  condominio_id: string
  unidade_id: string
  pessoa_id: string | null
  ocorrencia_id: string | null
  assunto: string
  descricao: string
  artigo_regimento: string | null
  observacoes: string | null
}
