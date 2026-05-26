export type TipoNotificacao =
  | 'ocorrencia'
  | 'multa'
  | 'encomenda'
  | 'mural'
  | 'evento'
  | 'sistema'

export interface AppNotification {
  id: string
  user_id: string
  condominio_id: string | null
  tipo: TipoNotificacao
  titulo: string
  conteudo: string | null
  link: string | null
  lida: boolean
  lida_em: string | null
  created_at: string
}
