export type StatusVotacao = 'aberta' | 'encerrada' | 'cancelada'

export interface Votacao {
  id: string
  condominio_id: string
  criado_por: string
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string | null
  status: StatusVotacao
  ativo: boolean
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
  user_id: string
  created_at: string
}

export interface VotacaoInput {
  condominio_id: string
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string | null
  opcoes: string[]  // texto de cada opção, ordem = posição no array
}
