export type AssuntoConversa = 'multa' | 'encomenda' | 'manutencao' | 'sugestao' | 'outro'

export type StatusConversa = 'aberta' | 'aguardando_humano' | 'em_atendimento' | 'encerrada'

export type AutorTipoMensagem = 'morador' | 'staff' | 'bot' | 'sistema'

export interface Conversa {
  id: string
  condominio_id: string
  morador_user_id: string
  assunto: AssuntoConversa
  status: StatusConversa
  atribuida_para: string | null
  ultima_mensagem_at: string | null
  created_at: string
  updated_at: string
}

export interface Mensagem {
  id: string
  conversa_id: string
  autor_id: string | null
  autor_tipo: AutorTipoMensagem
  conteudo: string
  metadata: Record<string, unknown> | null
  lida_em: string | null
  created_at: string
}
