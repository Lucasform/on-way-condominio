import { supabase } from './supabase'

export type ConviteRole =
  | 'morador'
  | 'portaria'
  | 'ronda'
  | 'administradora'
  | 'sindico'
  | 'subsindico'
  | 'conselheiro'

export type TipoVinculo =
  | 'titular'
  | 'conjuge'
  | 'filho'
  | 'dependente'
  | 'inquilino'
  | 'morador'
  | 'funcionario'
  | 'outro'

export interface Convite {
  id: string
  condominio_id: string
  codigo: string
  role: ConviteRole
  usos_max: number
  usos: number
  expira_em: string
  revogado: boolean
  criado_por: string
  created_at: string
  unidade_id: string | null
  setor: string | null
  pessoa_nome: string | null
  tipo_vinculo: TipoVinculo | null
}

export interface ConviteInput {
  condominio_id: string
  codigo?: string                // se vazio, gera automático
  role?: ConviteRole             // default 'morador'
  usos_max?: number              // default 1
  dias_validade?: number         // default 30
  unidade_id?: string | null
  setor?: string | null
  pessoa_nome?: string | null
  tipo_vinculo?: TipoVinculo | null
}

export interface ConvitePreview {
  condominio_id: string | null
  nome_condominio: string | null
  role: ConviteRole | null
  unidade_id: string | null
  unidade_label: string | null
  setor: string | null
  pessoa_nome: string | null
  tipo_vinculo: TipoVinculo | null
  valido: boolean
  motivo: string | null
}

export async function listConvites(condominio_id: string): Promise<Convite[]> {
  const { data, error } = await supabase
    .from('convites_condominio')
    .select('*')
    .eq('condominio_id', condominio_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Convite[]
}

export async function createConvite(input: ConviteInput): Promise<Convite> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Sem sessão.')

  const codigo = (input.codigo ?? gerarCodigo()).replace(/\s+/g, '').toUpperCase()
  const dias = input.dias_validade ?? 30
  const expira = new Date()
  expira.setDate(expira.getDate() + dias)

  const { data, error } = await supabase
    .from('convites_condominio')
    .insert({
      condominio_id: input.condominio_id,
      codigo,
      role: input.role ?? 'morador',
      usos_max: input.usos_max ?? 1,
      expira_em: expira.toISOString(),
      criado_por: user.user.id,
      unidade_id: input.unidade_id ?? null,
      setor: input.setor?.trim() || null,
      pessoa_nome: input.pessoa_nome?.trim() || null,
      tipo_vinculo: input.tipo_vinculo ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Convite
}

export async function revogarConvite(id: string): Promise<void> {
  const { error } = await supabase
    .from('convites_condominio')
    .update({ revogado: true })
    .eq('id', id)
  if (error) throw error
}

export async function deleteConvite(id: string): Promise<void> {
  const { error } = await supabase.from('convites_condominio').delete().eq('id', id)
  if (error) throw error
}

export async function renovarConvite(id: string, dias_validade = 30): Promise<Convite> {
  const expira = new Date()
  expira.setDate(expira.getDate() + dias_validade)
  const { data, error } = await supabase
    .from('convites_condominio')
    .update({ expira_em: expira.toISOString(), revogado: false, usos: 0 })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Convite
}

export async function previewConvite(codigo: string): Promise<ConvitePreview | null> {
  const { data, error } = await supabase.rpc('preview_convite', { p_codigo: codigo })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row ? (row as ConvitePreview) : null
}

export interface UnidadeConvite {
  id: string
  bloco: string | null
  numero: string
  label: string
}

export async function listarUnidadesDeConvite(codigo: string): Promise<UnidadeConvite[]> {
  const { data, error } = await supabase.rpc('listar_unidades_de_convite', { p_codigo: codigo })
  if (error) throw error
  return (data ?? []) as UnidadeConvite[]
}

export async function redeemInviteCode(input: {
  email: string
  password: string
  nome: string
  codigo: string
  unidade_id?: string | null
  setor?: string | null
  tipo_vinculo?: TipoVinculo | null
  cpf?: string | null
  telefone?: string | null
}): Promise<{ ok: boolean; error?: string; session?: { access_token: string; refresh_token: string } }> {
  const { data, error } = await supabase.functions.invoke('redeem-invite-code', { body: input })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  if (data?.session) {
    await supabase.auth.setSession(data.session)
  }
  return { ok: true, session: data?.session }
}

function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/I/1
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
