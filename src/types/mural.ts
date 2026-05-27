export type TipoReacao = 'like' | 'dislike' | 'curtir' | 'amei' | 'aplaudir'

export interface Publicacao {
  id: string
  condominio_id: string
  autor_id: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  fixado: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface PublicacaoInput {
  condominio_id: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  fixado: boolean
}

export interface Reacao {
  id: string
  publicacao_id: string
  user_id: string
  tipo: TipoReacao
  created_at: string
}
