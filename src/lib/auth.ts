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

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${SITE_URL}/atualizar-senha`,
  })
  if (error) throw error
}

// ============================================================
// Atualizar senha (depois do clique no link de reset)
// ============================================================

export async function updatePassword(novaSenha: string) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
}

// ============================================================
// Sair
// ============================================================

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ============================================================
// Perfil do user logado
// ============================================================

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
