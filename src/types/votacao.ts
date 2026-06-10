export type StatusVotacao = 'aberta' | 'encerrada' | 'cancelada'
export type ModoVotacao = 'todos' | 'qrcode'

export interface Votacao {
  id: string
  condominio_id: string
  assembleia_id: string | null
  criado_por: string
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string | null
  status: StatusVotacao
  modo: ModoVotacao
  codigo_acesso: string | null
  ativo: boolean
  quorum_minimo: number | null
  created_at: string
  updated_at: string
}

export interface VotacaoOpcao {
  id: string
  votacao_id: string
  texto: string
  ordem: number
  created_at: string
}

export interface Voto {
  id: string
  votacao_id: string
  opcao_id: string
  user_id: string | null
  unidade_id: string | null
  eleitor_nome: string | null
  verificado: boolean
  created_at: string
}

export interface VotacaoInput {
  condominio_id: string
  assembleia_id?: string | null
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string | null
  quorum_minimo?: number | null
  modo?: ModoVotacao
  codigo_acesso?: string | null
  opcoes: string[]  // texto de cada opção, ordem = posição no array
}
