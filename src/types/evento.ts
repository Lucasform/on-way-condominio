export type TipoEvento = 'assembleia' | 'manutencao' | 'evento' | 'reuniao' | 'outro'

export interface Evento {
  id: string
  condominio_id: string
  criado_por: string
  titulo: string
  descricao: string | null
  data_inicio: string  // ISO timestamptz
  data_fim: string | null
  local: string | null
  tipo: TipoEvento
  publico: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EventoInput {
  condominio_id: string
  titulo: string
  descricao: string | null
  data_inicio: string  // ISO date or datetime
  data_fim: string | null
  local: string | null
  tipo: TipoEvento
  publico: boolean
}
