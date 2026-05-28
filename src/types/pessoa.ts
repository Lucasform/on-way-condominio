export type TipoVinculo =
  | 'titular'
  | 'conjuge'
  | 'filho'
  | 'dependente'
  | 'inquilino'
  | 'funcionario'
  | 'outro'
  | 'morador'

export type RelacaoUnidade = 'proprietario' | 'inquilino' | 'morador' | null

export interface Pessoa {
  id: string
  condominio_id: string
  unidade_id: string | null
  user_id: string | null
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  tipo_vinculo: TipoVinculo
  relacao_unidade: RelacaoUnidade
  setor: string | null
  foto_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type PessoaInput = Omit<Pessoa, 'id' | 'user_id' | 'ativo' | 'created_at' | 'updated_at'>
