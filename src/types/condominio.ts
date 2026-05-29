export type Plano = 'free' | 'pro' | 'enterprise'

export interface Condominio {
  id: string
  nome: string
  cnpj: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  administradora: string | null
  logo_url: string | null
  regimento_pdf_url: string | null
  modelo_notificacao_url: string | null
  modelo_notificacao_texto: string | null
  ai_instrucoes: string | null
  slug: string | null
  cor_primaria: string | null
  texto_login: string | null
  imagem_login_url: string | null
  permite_signup: boolean
  mensagem_boas_vindas: string | null
  plano: Plano
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CondominioInput = Omit<Condominio, 'id' | 'ativo' | 'created_at' | 'updated_at'>
