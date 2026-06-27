export type CategoriaChamado =
  | 'eletrica'
  | 'hidraulica'
  | 'jardim'
  | 'limpeza'
  | 'seguranca'
  | 'elevador'
  | 'estrutural'
  | 'outro'

export type PrioridadeChamado = 'baixa' | 'media' | 'alta' | 'urgente'

export type StatusChamado =
  | 'pendente_aprovacao'
  | 'aberto'
  | 'em_andamento'
  | 'aguardando'
  | 'resolvido'
  | 'finalizado'
  | 'cancelado'

export interface Chamado {
  id: string
  condominio_id: string
  unidade_id: string | null
  aberto_por: string
  titulo: string
  descricao: string
  categoria: CategoriaChamado
  prioridade: PrioridadeChamado
  status: StatusChamado
  custo_estimado: number | null
  aprovado_por: string | null
  aprovado_em: string | null
  foto_url: string | null
  atribuido_para: string | null
  resolvido_em: string | null
  resolucao_nota: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ChamadoInput {
  condominio_id: string
  unidade_id: string | null
  titulo: string
  descricao: string
  categoria: CategoriaChamado
  prioridade: PrioridadeChamado
  custo_estimado?: number | null
}
