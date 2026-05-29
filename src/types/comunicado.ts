export type StatusComunicado = 'rascunho' | 'enviado' | 'arquivado'

export interface Comunicado {
  id: string
  condominio_id: string
  criado_por: string | null
  titulo: string
  descricao: string
  corpo: string
  modelo_anexo_id: string | null
  ia_modelo: string | null
  status: StatusComunicado
  enviado_em: string | null
  enviado_por_email: boolean
  destinatarios: number
  created_at: string
  updated_at: string
}

export interface ComunicadoInput {
  condominio_id: string
  titulo: string
  descricao: string
  corpo: string
  modelo_anexo_id?: string | null
  ia_modelo?: string | null
}
