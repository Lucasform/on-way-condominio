import type { Role } from '../types/database'

// Quem tem poderes de "gestor": admin geral + sindico + subsindico.
// E o grupo que pode apagar registros (multas, ocorrencias, chamados, etc).
export function isGestor(role?: Role | null): boolean {
  if (!role) return false
  return role === 'admin_onway' || role === 'parceiro' || role === 'admin' || role === 'sindico' || role === 'subsindico'
}

// Staff operacional: gestores + administradora. Quem pode editar cadastros,
// emitir multa/notificacao, etc.
export function isStaff(role?: Role | null): boolean {
  if (!role) return false
  return isGestor(role) || role === 'administradora'
}

export function canDelete(role?: Role | null): boolean {
  return isGestor(role)
}

// Parceiro = gestor externo multi-condo criado via convite de plataforma
export function isParceiro(role?: Role | null): boolean {
  return role === 'parceiro'
}
