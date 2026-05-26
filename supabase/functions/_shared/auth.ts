// Helper para Edge Functions: identifica quem chama e devolve cliente Supabase
// com JWT do user (para RLS) + cliente admin (service role) + perfil.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type Role =
  | 'admin_onway'
  | 'administradora'
  | 'sindico'
  | 'portaria'
  | 'ronda'
  | 'morador'

export interface CallerPerfil {
  id: string
  condominio_id: string | null
  role: Role
  ativo: boolean
}

export interface Caller {
  userId: string
  perfil: CallerPerfil
  userClient: SupabaseClient
  admin: SupabaseClient
}

export async function getCaller(req: Request): Promise<Caller> {
  const auth = req.headers.get('Authorization')
  if (!auth) throw new HttpError('Authorization obrigatório.', 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user }, error: uErr } = await userClient.auth.getUser()
  if (uErr || !user) throw new HttpError('Sessão inválida.', 401)

  const { data: perfil, error: pErr } = await admin
    .from('perfis')
    .select('id, condominio_id, role, ativo')
    .eq('id', user.id)
    .maybeSingle()

  if (pErr) throw new HttpError(`Falha ao carregar perfil: ${pErr.message}`, 500)
  if (!perfil) throw new HttpError('Usuário sem perfil cadastrado.', 403)
  if (!perfil.ativo) throw new HttpError('Perfil desativado.', 403)

  return { userId: user.id, perfil: perfil as CallerPerfil, userClient, admin }
}

// Matriz: quem pode criar/gerenciar quem.
const STAFF_ROLES: Role[] = ['admin_onway', 'administradora', 'sindico']

export function canManagePessoas(role: Role): boolean {
  return STAFF_ROLES.includes(role)
}

// Roles que cada perfil pode CRIAR ao convidar alguém.
const CAN_CREATE: Record<Role, Role[]> = {
  admin_onway:    ['administradora', 'sindico', 'portaria', 'ronda', 'morador'],
  administradora: ['sindico', 'portaria', 'ronda', 'morador'],
  sindico:        ['portaria', 'ronda', 'morador'],
  portaria:       [],
  ronda:          [],
  morador:        [],
}

export function canCreateRole(callerRole: Role, targetRole: Role): boolean {
  return (CAN_CREATE[callerRole] ?? []).includes(targetRole)
}

// Garante que o caller tem escopo no condomínio alvo.
export function assertSameScope(caller: Caller, condominio_id: string) {
  if (caller.perfil.role === 'admin_onway') return
  if (caller.perfil.condominio_id !== condominio_id) {
    throw new HttpError('Sem acesso a esse condomínio.', 403)
  }
}

export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}
