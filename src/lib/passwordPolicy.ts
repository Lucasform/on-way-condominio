// Política de senha — alinhada ao Supabase Auth config (password_min_length=8 + classes)
export const PASSWORD_MIN_LENGTH = 8

export interface PasswordCheck {
  ok: boolean
  errors: string[]
}

export function validatePassword(senha: string): PasswordCheck {
  const errors: string[] = []
  if (senha.length < PASSWORD_MIN_LENGTH) errors.push(`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
  if (!/[a-z]/.test(senha)) errors.push('Pelo menos uma letra minúscula')
  if (!/[A-Z]/.test(senha)) errors.push('Pelo menos uma letra maiúscula')
  if (!/\d/.test(senha)) errors.push('Pelo menos um número')
  return { ok: errors.length === 0, errors }
}

export const PASSWORD_HINT =
  `Mín. ${PASSWORD_MIN_LENGTH} caracteres, com minúscula, maiúscula e número.`
