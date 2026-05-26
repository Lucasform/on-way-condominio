export type Role =
  | 'admin_onway'
  | 'administradora'
  | 'sindico'
  | 'portaria'
  | 'ronda'
  | 'morador'

export interface Perfil {
  id: string
  condominio_id: string | null
  role: Role
  nome_exibicao: string | null
  telefone: string | null
  avatar_url: string | null
  assinatura_url: string | null
  bio: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}
