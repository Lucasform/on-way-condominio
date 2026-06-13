export type TipoAssembleia = 'ordinaria' | 'extraordinaria'
export type StatusAssembleia = 'planejada' | 'realizada' | 'cancelada'
export type CargoMesa = 'presidente_mesa' | 'secretario' | 'coordenador' | 'outro'

export interface MesaMembro {
  nome: string
  cpf: string
  cargo: CargoMesa
  assinatura_url?: string | null
}

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
  mesa_diretora: MesaMembro[]
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

export interface AssembleiaPresenca {
  id: string
  assembleia_id: string
  user_id: string
  confirmou_em: string
  presente_em: string | null
}
