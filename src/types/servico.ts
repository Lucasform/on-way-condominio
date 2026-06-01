export type CategoriaServico =
  | 'eletrica'
  | 'hidraulica'
  | 'jardim'
  | 'limpeza'
  | 'seguranca'
  | 'elevador'
  | 'estrutural'
  | 'outro'

export type StatusServico = 'agendado' | 'em_andamento' | 'concluido' | 'cancelado'

export interface Prestador {
  id: string
  condominio_id: string
  nome: string
  categoria: CategoriaServico
  telefone: string | null
  email: string | null
  documento: string | null
  valor_referencia: number | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface PrestadorInput {
  condominio_id: string
  nome: string
  categoria: CategoriaServico
  telefone: string | null
  email: string | null
  documento: string | null
  valor_referencia: number | null
  observacoes: string | null
}

export interface Servico {
  id: string
  condominio_id: string
  prestador_id: string | null
  titulo: string
  descricao: string | null
  categoria: CategoriaServico
  status: StatusServico
  data_inicio: string | null
  data_fim: string | null
  valor: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface ServicoInput {
  condominio_id: string
  prestador_id: string | null
  titulo: string
  descricao: string | null
  categoria: CategoriaServico
  status: StatusServico
  data_inicio: string | null
  data_fim: string | null
  valor: number | null
  observacoes: string | null
}

export const CATEGORIA_LABEL: Record<CategoriaServico, string> = {
  eletrica: 'Elétrica',
  hidraulica: 'Hidráulica',
  jardim: 'Jardim',
  limpeza: 'Limpeza',
  seguranca: 'Segurança',
  elevador: 'Elevador',
  estrutural: 'Estrutural',
  outro: 'Outro',
}

export const STATUS_LABEL: Record<StatusServico, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const STATUS_CLASS: Record<StatusServico, string> = {
  agendado: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_andamento: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  concluido: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

export const STATUS_TONE: Record<StatusServico, 'warning' | 'info' | 'success' | 'neutral'> = {
  agendado: 'warning',
  em_andamento: 'info',
  concluido: 'success',
  cancelado: 'neutral',
}
