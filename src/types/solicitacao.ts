export type TipoSolicitacao = 'duvida' | 'reclamacao' | 'sugestao' | 'outros'
export type StatusSolicitacao = 'enviado' | 'analise' | 'respondido'

export interface Solicitacao {
  id: string
  condominio_id: string
  unidade_id: string | null
  autor_id: string
  tipo: TipoSolicitacao
  titulo: string
  descricao: string
  status: StatusSolicitacao
  created_at: string
  updated_at: string
  // joins opcionais
  autor_nome?: string | null
  unidade_nome?: string | null
}

export interface SolicitacaoMensagem {
  id: string
  solicitacao_id: string
  autor_id: string
  texto: string
  criado_at: string
  autor_nome?: string | null
  autor_role?: string | null
}

export interface SolicitacaoInput {
  condominio_id: string
  unidade_id?: string | null
  tipo: TipoSolicitacao
  titulo: string
  descricao: string
}
