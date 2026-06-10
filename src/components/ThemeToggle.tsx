import { useEffect, useState } from 'react'
import { getStoredTheme, setStoredTheme, resolveTheme } from '../lib/theme'

/**
 * Alterna entre claro e escuro. O claro é novo (rampa invertida); o default
 * segue dark. Persiste a escolha e aplica na hora.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(resolveTheme(getStoredTheme()) === 'dark')
  }, [])

  function toggle() {
    const next = dark ? 'light' : 'dark'
    setDark(!dark)
    setStoredTheme(next)
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="p-2 rounded-md text-slate-400 hover:bg-slate-800 transition"
        aria-label={dark ? 'Mudar pra tema claro' : 'Mudar pra tema escuro'}
        title={dark ? 'Tema claro' : 'Tema escuro'}
      >
        {dark ? '☀️' : '🌙'}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-slate-700 hover:bg-slate-800 transition text-slate-300"
    >
      <span>{dark ? '☀️' : '🌙'}</span>
      <span>{dark ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  )
}
