// Tema dark/light. Persiste em localStorage. Aplica classe `dark` no <html>.

export type Theme = 'dark' | 'light' | 'system'
const KEY = 'onway:theme'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const v = localStorage.getItem(KEY) as Theme | null
  return v ?? 'dark'
}

export function setStoredTheme(t: Theme) {
  if (typeof window === 'undefined') return
  if (t === 'dark') localStorage.setItem(KEY, 'dark')
  else if (t === 'light') localStorage.setItem(KEY, 'light')
  else localStorage.removeItem(KEY)
  applyTheme(t)
}

export function applyTheme(t: Theme = getStoredTheme()) {
  if (typeof document === 'undefined') return
  const isDark =
    t === 'dark' ||
    (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

/** Aplica antes do React montar pra evitar flash. Chamar no main.tsx. */
export function bootstrapTheme() {
  applyTheme()
}
