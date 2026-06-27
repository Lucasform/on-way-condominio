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
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Atalhos</span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          title={editing ? 'Fechar edição' : 'Personalizar atalhos'}
        >
          {editing ? '✕ fechar' : '✏️ editar'}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-wrap gap-2">
          {catalog.map((s) => {
            const on = selectedIds.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  on
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                {on ? <span className="text-violet-400">✓</span> : <span className="text-slate-600">+</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active.map((s) => (
            <Link
              key={s.id}
              to={s.to}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
