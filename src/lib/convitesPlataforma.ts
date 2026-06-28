import { supabase } from './supabase'

export interface ConvitePlataforma {
  id: string
  codigo: string
  role: string
  nome_destinatario: string | null
  email_destinatario: string | null
  criado_por: string | null
  usos: number
  usos_max: number
  expira_em: string
  revogado: boolean
  created_at: string
}

function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function listConvitesPlataforma(): Promise<ConvitePlataforma[]> {
  const { data, error } = await supabase
    .from('convites_plataforma')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ConvitePlataforma[]
}

export async function createConvitePlataforma(input: {
  nome_destinatario?: string
  usos_max?: number
  dias_validade?: number
}): Promise<ConvitePlataforma> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Sem sessão.')

  const codigo = gerarCodigo()
  const expira = new Date()
  expira.setDate(expira.getDate() + (input.dias_validade ?? 30))

  const { data, error } = await supabase
    .from('convites_plataforma')
    .insert({
      codigo,
      role: 'parceiro',
      nome_destinatario: input.nome_destinatario?.trim() || null,
      criado_por: user.user.id,
      usos_max: input.usos_max ?? 1,
      expira_em: expira.toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ConvitePlataforma
}

export async function revogarConvitePlataforma(id: string): Promise<void> {
  const { error } = await supabase
    .from('convites_plataforma')
    .update({ revogado: true })
    .eq('id', id)
  if (error) throw error
}

export async function deleteConvitePlataforma(id: string): Promise<void> {
  const { error } = await supabase.from('convites_plataforma').delete().eq('id', id)
  if (error) throw error
}

export interface SendInviteResult extends ConvitePlataforma {
  email_enviado: boolean
}

export async function sendInvitePorEmail(input: {
  email: string
  nome?: string
}): Promise<SendInviteResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sem sessão.')

  const res = await supabase.functions.invoke<SendInviteResult>('send-plataforma-invite', {
    body: { email: input.email, nome: input.nome ?? null },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (res.error) throw res.error
  if (!res.data) throw new Error('Resposta vazia da função.')
  return res.data
}

export async function listParceiros(): Promise<{ id: string; nome: string | null; email: string | null; ativo: boolean; created_at: string }[]> {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome_exibicao, ativo, created_at')
    .eq('role', 'parceiro')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome_exibicao,
    email: null,
    ativo: p.ativo,
    created_at: p.created_at,
  }))
}

export interface PerfilCondominio {
  id: string
  condominio_id: string
  condominio_nome: string
  ativo: boolean
}

export async function listCondominiosDoParceiro(perfilId: string): Promise<PerfilCondominio[]> {
  const { data, error } = await supabase
    .from('perfis_condominios')
    .select('id, condominio_id, ativo, condominios:condominio_id(nome)')
    .eq('perfil_id', perfilId)
  if (error) throw error
  return (data ?? []).map((row) => {
    const c = row.condominios as unknown as { nome: string } | null
    return {
      id: row.id,
      condominio_id: row.condominio_id,
      condominio_nome: c?.nome ?? '—',
      ativo: row.ativo,
    }
  })
}

export async function vincularParceiroCondominio(perfilId: string, condominioId: string): Promise<void> {
  const { error } = await supabase
    .from('perfis_condominios')
    .upsert({ perfil_id: perfilId, condominio_id: condominioId, role: 'admin', ativo: true })
  if (error) throw error
}

export async function toggleVinculoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('perfis_condominios').update({ ativo }).eq('id', id)
  if (error) throw error
}
