import { supabase } from './supabase'
import type { Perfil } from '../types/database'

// ============================================================
// Constantes centralizadas
// ============================================================

const SITE_URL =
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  'https://on-way-condominio.vercel.app'

export const AUTH_REDIRECT_URL = `${SITE_URL}/auth/callback`

// Flag pra mostrar botão Google. Religar depois de configurar provider em
// https://supabase.com/dashboard/project/lkxnngzgmyfqgbbpmjvc/auth/providers
export const GOOGLE_AUTH_ENABLED = false

// ============================================================
// Login com senha (clássico)
// ============================================================

/**
 * Autentica o usuário com e-mail e senha.
 * @param email E-mail do usuário (será trimado)
 * @param password Senha
 * @returns Dados da sessão do Supabase Auth
 * @throws Erro de autenticação em credenciais inválidas ou conta inativa
 */
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

// ============================================================
// Login com magic link (sem senha)
// ============================================================

/**
 * Envia magic link para o e-mail informado. Funciona apenas para usuários já cadastrados.
 * @param email E-mail do usuário (será trimado)
 * @throws Erro do Supabase se o e-mail não existir ou falha no envio
 */
export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: AUTH_REDIRECT_URL,
      shouldCreateUser: false, // só pra usuários já existentes
    },
  })
  if (error) throw error
}

// ============================================================
// Signup (criar conta)
// ============================================================

export interface SignupInput {
  email: string
  password: string
  nome?: string
}

/**
 * Cria uma nova conta de usuário.
 * @param input Dados de cadastro: e-mail obrigatório, senha obrigatória e nome opcional
 * @returns Dados da sessão/usuário criado pelo Supabase Auth
 * @throws Erro se e-mail já existir ou se a senha não atender os requisitos
 */
export async function signUp(input: SignupInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: AUTH_REDIRECT_URL,
      data: { nome: input.nome?.trim() ?? null },
    },
  })
  if (error) throw error
  return data
}

// ============================================================
// Login com Google (OAuth)
// ============================================================

/**
 * Inicia fluxo OAuth com Google. Redireciona o browser para o provider.
 * Deve ser habilitado no dashboard Supabase antes de usar (`GOOGLE_AUTH_ENABLED`).
 * @throws Erro do Supabase se o provider Google não estiver configurado
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT_URL },
  })
  if (error) throw error
}

// ============================================================
// Esqueci senha — solicitar reset
// ============================================================

/**
 * Envia e-mail de redefinição de senha para o endereço informado.
 * @param email E-mail do usuário (será trimado)
 * @throws Erro do Supabase em caso de falha no envio
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${SITE_URL}/atualizar-senha`,
  })
  if (error) throw error
}

// ============================================================
// Atualizar senha (depois do clique no link de reset)
// ============================================================

/**
 * Atualiza a senha do usuário autenticado. Deve ser chamado após o clique no link de reset.
 * @param novaSenha Nova senha a definir
 * @throws Erro do Supabase se a sessão for inválida ou a senha não atender os requisitos
 */
export async function updatePassword(novaSenha: string) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
}

// ============================================================
// Sair
// ============================================================

// Sinaliza pro AuthProvider que o SIGNED_OUT que vai chegar é intencional —
// pula a janela de graça e desloga na hora.
const LOGOUT_INTENT_KEY = 'onway:logout-intent'

/**
 * Sinaliza no sessionStorage que o logout foi intencional.
 * Permite que o AuthProvider ignore a janela de graça e deslogue imediatamente.
 */
export function markLogoutIntent() {
  try { sessionStorage.setItem(LOGOUT_INTENT_KEY, '1') } catch { /* ignore */ }
}

/**
 * Lê e remove a flag de intenção de logout do sessionStorage.
 * @returns `true` se havia uma intenção de logout pendente, `false` caso contrário
 */
export function consumeLogoutIntent(): boolean {
  try {
    const v = sessionStorage.getItem(LOGOUT_INTENT_KEY)
    if (v) sessionStorage.removeItem(LOGOUT_INTENT_KEY)
    return v === '1'
  } catch { return false }
}

/**
 * Encerra a sessão do usuário autenticado.
 * Marca a intenção de logout antes de chamar o Supabase para evitar re-login automático.
 * @throws Erro do Supabase em caso de falha no signOut
 */
export async function signOut() {
  markLogoutIntent()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ============================================================
// Perfil do user logado
// ============================================================

/**
 * Busca o perfil ativo do usuário autenticado na tabela `perfis`.
 * @param userId UUID do usuário (auth.users.id)
 * @returns Perfil encontrado ou `null` se o usuário não tiver perfil ativo
 * @throws Erro do Supabase em caso de falha na consulta
 */
export async function fetchCurrentPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  return data as Perfil | null
}
