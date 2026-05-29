export type TipoAcesso = 'visitante' | 'prestador' | 'entregador' | 'familiar' | 'fixo'
export type StatusAcesso = 'ativo' | 'usado' | 'expirado' | 'revogado' | 'negado'
export type DocumentoTipo = 'cpf' | 'rg' | 'cnh' | 'passaporte' | 'outro'
export type TipoEventoAcesso = 'entrada' | 'saida' | 'negada' | 'revogada'
export type ModalidadeVigencia = 'hoje' | 'data' | 'periodo' | 'indefinido' | 'recorrente'

export interface Recorrencia {
  dias_semana?: string[]    // ['seg','ter','qua','qui','sex','sab','dom']
  horario_inicio?: string   // 'HH:MM'
  horario_fim?: string      // 'HH:MM'
}

export interface AcessoAutorizado {
  id: string
  condominio_id: string
  unidade_id: string
  criado_por: string | null
  pessoa_id: string | null
  nome: string
  documento_tipo: DocumentoTipo | null
  documento_numero: string | null
  telefone: string | null
  tipo: TipoAcesso
  modalidade_vigencia: ModalidadeVigencia
  vigencia_inicio: string
  vigencia_fim: string | null
  recorrencia: Recorrencia | null
  status: StatusAcesso
  uso_unico: boolean
  placa_veiculo: string | null
  acompanhantes_permitidos: number
  notificar_entrada: boolean
  foto_url: string | null
  observacao: string | null
  created_at: string
  updated_at: string
}

export interface AcessoAutorizadoInput {
  condominio_id: string
  unidade_id: string
  pessoa_id?: string | null
  nome: string
  documento_tipo?: DocumentoTipo | null
  documento_numero?: string | null
  telefone?: string | null
  tipo: TipoAcesso
  modalidade_vigencia?: ModalidadeVigencia
  vigencia_inicio?: string
  vigencia_fim?: string | null
  recorrencia?: Recorrencia | null
  uso_unico?: boolean
  placa_veiculo?: string | null
  acompanhantes_permitidos?: number
  notificar_entrada?: boolean
  foto_url?: string | null
  observacao?: string | null
}

export interface AcessoEvento {
  id: string
  acesso_id: string
  condominio_id: string
  tipo: TipoEventoAcesso
  registrado_por: string | null
  motivo: string | null
  created_at: string
}
