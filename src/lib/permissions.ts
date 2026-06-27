import type { Role } from '../types/database'

/**
 * Verifica se o perfil tem poder de gestor (admin_onway, parceiro, admin, sindico ou subsindico).
 * Gestores podem apagar registros de multas, ocorrências e chamados.
 * @param role Role do perfil autenticado
 */
export function isGestor(role?: Role | null): boolean {
  if (!role) return false
  return role === 'admin_onway' || role === 'parceiro' || role === 'admin' || role === 'sindico' || role === 'subsindico'
}

/**
 * Verifica se o perfil é staff operacional (gestores + administradora).
 * Staff pode editar cadastros, emitir multas e notificações.
 * @param role Role do perfil autenticado
 */
export function isStaff(role?: Role | null): boolean {
  if (!role) return false
  return isGestor(role) || role === 'administradora'
}

/** Verifica se o perfil pode apagar registros (multas, ocorrências, chamados). Equivale a `isGestor`. */
export function canDelete(role?: Role | null): boolean {
  return isGestor(role)
}

/**
 * Verifica se o perfil é parceiro (gestor externo multi-condomínio criado via convite de plataforma).
 * @param role Role do perfil autenticado
 */
export function isParceiro(role?: Role | null): boolean {
  return role === 'parceiro'
}
