import { supabase } from './supabase'

export type ConviteRole = 'morador' | 'portaria' | 'ronda'

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
}

export interface ConviteInput {
  condominio_id: string
  codigo?: string                // se vazio, gera automático
  role?: ConviteRole             // default 'morador'
  usos_max?: number              // default 1
  dias_validade?: number         // default 30
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

  const codigo = (input.codigo ?? gerarCodigo()).toUpperCase()
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

export async function redeemInviteCode(input: {
  email: string
  password: string
  nome: string
  codigo: string
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
