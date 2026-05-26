// Tema dark forçado. Light mode foi removido por baixo contraste.
// Mantemos os exports legados pra compatibilidade com chamadas existentes.

export type Theme = 'dark' | 'light' | 'system'

export function getStoredTheme(): Theme {
  return 'dark'
}

export function setStoredTheme(_t: Theme) {
  // no-op — app fixado em dark
}

export function applyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.add('dark')
  // limpa preferencia antiga pra evitar flash de tema claro em sessoes antigas
  try { localStorage.removeItem('onway:theme') } catch { /* ignore */ }
}

/** Aplica antes do React montar pra evitar flash. Chamar no main.tsx. */
export function bootstrapTheme() {
  applyTheme()
}
