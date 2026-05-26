export type AutorTipo = 'morador' | 'staff'

export interface Contestacao {
  id: string
  multa_id: string
  autor_id: string
  autor_tipo: AutorTipo
  mensagem: string
  created_at: string
}
