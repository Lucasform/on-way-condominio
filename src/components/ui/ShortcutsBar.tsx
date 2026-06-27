import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useShortcuts } from '../../hooks/useShortcuts'

interface Props { role: string | undefined; userId: string | undefined }

export default function ShortcutsBar({ role, userId }: Props) {
  const { catalog, active, selectedIds, toggle } = useShortcuts(role, userId)
  const [editing, setEditing] = useState(false)

  if (catalog.length === 0) return null

  return (
    <div className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Atalhos
        </span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {editing ? (
            'Concluir'
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Configurar
            </>
          )}
        </button>
      </div>

      {editing ? (
        /* Edit mode: expanded panel with checkbox grid */
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400 mb-3">
            Escolha os atalhos que você mais usa — eles abrem a ação em 1 clique.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {catalog.map((s) => {
              const checked = selectedIds.includes(s.id)
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer select-none transition-colors ${
                    checked
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s.id)}
                    className="accent-violet-500 w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className={`text-sm ${checked ? 'text-slate-200' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ) : (
        /* View mode: compact pill buttons */
        <div className="flex flex-wrap gap-2">
          {active.map((s) => (
            <Link
              key={s.id}
              to={s.to}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 bg-slate-900/40 hover:bg-slate-800 hover:border-slate-600 text-sm text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          ))}
          {active.length === 0 && (
            <span className="text-xs text-slate-600 py-2">
              Nenhum atalho selecionado — clique em Configurar.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
