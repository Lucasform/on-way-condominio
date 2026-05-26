export type WhatsappProvider = 'z-api' | 'evolution'

export interface WhatsappConfig {
  id: string
  condominio_id: string
  provider: WhatsappProvider
  api_url: string | null
  instance_id: string | null
  api_token: string | null
  numero_envio: string | null
  webhook_secret: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface WhatsappConfigInput {
  condominio_id: string
  provider: WhatsappProvider
  api_url: string
  instance_id: string
  api_token: string
  numero_envio: string
  ativo: boolean
}
