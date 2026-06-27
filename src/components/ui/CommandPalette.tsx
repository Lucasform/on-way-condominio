import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NAV_COMMANDS, filterCommands } from '../../lib/navCommands'
import { useAuth } from '../AuthProvider'

interface Props { open: boolean; onClose: () => void }

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const results = filterCommands(NAV_COMMANDS, perfil?.role, query)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = results[cursor]
        if (cmd) { navigate(cmd.to); onClose() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, cursor, results, navigate, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <span className="text-slate-500 text-sm">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            placeholder="Buscar página..."
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-sm"
          />
          <kbd className="text-[10px] text-slate-500 border border-slate-700/60 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <ul className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma página encontrada.</li>
          ) : results.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  i === cursor ? 'bg-violet-500/20 text-violet-200' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
                onClick={() => { navigate(cmd.to); onClose() }}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="w-5 text-center shrink-0">{cmd.icon}</span>
                <span>{cmd.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-slate-800 flex gap-4 text-[11px] text-slate-600">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  )
}
