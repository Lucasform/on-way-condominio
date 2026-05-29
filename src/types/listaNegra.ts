import type { DocumentoTipo } from './acesso'

export interface ListaNegraItem {
  id: string
  condominio_id: string
  nome: string
  documento_tipo: DocumentoTipo | null
  documento_numero: string | null
  motivo: string | null
  ativo: boolean
  registrado_por: string | null
  created_at: string
  updated_at: string
}

export interface ListaNegraInput {
  condominio_id: string
  nome: string
  documento_tipo?: DocumentoTipo | null
  documento_numero?: string | null
  motivo?: string | null
}
