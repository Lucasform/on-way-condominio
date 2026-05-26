export type StatusOcorrencia =
  | 'aberta'
  | 'em_analise'
  | 'arquivada'
  | 'virou_multa'
  | 'cancelada'

export interface Ocorrencia {
  id: string
  condominio_id: string
  unidade_id: string | null
  pessoa_envolvida_id: string | null
  reportado_por: string
  local: string | null
  descricao: string
  foto_url: string | null
  status: StatusOcorrencia
  comentario_gestao: string | null
  created_at: string
  updated_at: string
}

export interface OcorrenciaPatch {
  unidade_id?: string | null
  local?: string | null
  comentario_gestao?: string | null
}

export interface OcorrenciaInput {
  condominio_id: string
  unidade_id: string | null
  pessoa_envolvida_id: string | null
  local: string | null
  descricao: string
  foto_url: string | null
}
