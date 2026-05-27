export type TipoAssembleia = 'ordinaria' | 'extraordinaria'
export type StatusAssembleia = 'planejada' | 'realizada' | 'cancelada'

export interface Assembleia {
  id: string
  condominio_id: string
  titulo: string
  tipo: TipoAssembleia
  data_assembleia: string
  local: string | null
  status: StatusAssembleia
  pauta: string | null
  ata_url: string | null
  ata_texto: string | null
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface AssembleiaInput {
  condominio_id: string
  titulo: string
  tipo: TipoAssembleia
  data_assembleia: string
  local?: string | null
  status?: StatusAssembleia
  pauta?: string | null
  observacoes?: string | null
}
