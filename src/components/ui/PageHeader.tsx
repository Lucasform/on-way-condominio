import type { ReactNode } from 'react'

// Em mobile: titulo em cima, acoes abaixo (flex-col), titulo menor.
// Em sm+: lado a lado, acoes encostadas a direita sem encolher (shrink-0).
// Em qualquer breakpoint, acoes podem quebrar em multiplas linhas (flex-wrap).
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6">
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:shrink-0">{actions}</div>
      )}
    </header>
  )
}
