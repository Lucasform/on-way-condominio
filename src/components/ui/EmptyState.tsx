import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Mensagem principal (ex.: "Nenhuma multa encontrada."). */
  message: ReactNode
  /** Ícone/emoji opcional acima da mensagem. */
  icon?: ReactNode
  /** Texto auxiliar abaixo da mensagem. */
  hint?: ReactNode
  /** Ação opcional (ex.: botão "+ Novo"). */
  action?: ReactNode
  className?: string
}

/**
 * Estado vazio padronizado ("sem registros").
 * Substitui os <div p-8 text-center> espalhados pelas listas.
 */
export default function EmptyState({ message, icon, hint, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-900/40 px-6 py-10 text-center ${className}`}
    >
      {icon && <div className="text-3xl mb-3 opacity-80">{icon}</div>}
      <p className="text-sm text-slate-400">{message}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
