// Tema dark/claro via classe .dark no <html>. Default = dark (sem regressão).
// O claro funciona pela rampa invertida de slate (ver index.css).

export type Theme = 'dark' | 'light' | 'system'

const KEY = 'onway:theme'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* ignore */ }
  return 'dark'
}

export function setStoredTheme(t: Theme) {
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  applyTheme(t)
}

function prefersDark(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return true }
}

export function resolveTheme(t: Theme = getStoredTheme()): 'dark' | 'light' {
  if (t === 'system') return prefersDark() ? 'dark' : 'light'
  return t
}

export function applyTheme(t: Theme = getStoredTheme()) {
  if (typeof document === 'undefined') return
  const isDark = resolveTheme(t) === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
}

/** Aplica antes do React montar pra evitar flash. Chamar no main.tsx. */
export function bootstrapTheme() {
  applyTheme()
}
