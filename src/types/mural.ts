export type TipoReacao = 'like' | 'dislike' | 'curtir' | 'amei' | 'aplaudir'

export interface Enquete {
  pergunta?: string
  opcoes: string[]
  encerra_em?: string
}

export interface Publicacao {
  id: string
  condominio_id: string
  autor_id: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  fixado: boolean
  ativo: boolean
  expira_em: string | null
  enquete: Enquete | null
  created_at: string
  updated_at: string
}

export interface PublicacaoInput {
  condominio_id: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  fixado: boolean
  expira_em?: string | null
  enquete?: Enquete | null
}

export interface PublicacaoVoto {
  publicacao_id: string
  user_id: string
  opcao_idx: number
  created_at: string
  updated_at: string
}

export interface Reacao {
  id: string
  publicacao_id: string
  user_id: string
  tipo: TipoReacao
  created_at: string
}

export interface ComentarioPublicacao {
  id: string
  publicacao_id: string
  user_id: string
  conteudo: string
  created_at: string
}

export interface PublicacaoLeitura {
  publicacao_id: string
  user_id: string
  lida_em: string
}
