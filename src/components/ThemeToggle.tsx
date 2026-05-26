import { useEffect, useState } from 'react'
import { getStoredTheme, setStoredTheme, type Theme } from '../lib/theme'

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setStoredTheme(next)
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
        aria-label={theme === 'dark' ? 'Mudar pra tema claro' : 'Mudar pra tema escuro'}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span className="text-slate-700 dark:text-slate-300">
        {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </span>
    </button>
  )
}
