import { useState, type ReactNode } from 'react'

// Em mobile: titulo em cima, acoes abaixo (flex-col).
// secondaryActions colapsa em "⋯ Mais" no mobile; exibe inline no sm+.
export default function PageHeader({
  title,
  subtitle,
  actions,
  secondaryActions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  secondaryActions?: ReactNode
}) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6">
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {(actions || secondaryActions) && (
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:shrink-0">
          {actions}
          {secondaryActions && (
            <>
              {/* sm+: secondary inline */}
              <div className="hidden sm:contents">{secondaryActions}</div>
              {/* mobile: collapse */}
              <div className="relative sm:hidden">
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  ⋯ Mais
                </button>
                {moreOpen && (
                  <div
                    className="absolute right-0 top-9 z-20 flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl min-w-max"
                    onBlur={() => setMoreOpen(false)}
                  >
                    {secondaryActions}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )
}
