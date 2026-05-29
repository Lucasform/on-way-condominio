import type { ReactNode } from 'react'

export type PillTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'

interface Props {
  tone?: PillTone
  children: ReactNode
  /** Mostra um ponto colorido no início. */
  dot?: boolean
  className?: string
}

const tones: Record<PillTone, string> = {
  neutral: 'bg-slate-800/60 text-slate-300 border-slate-700',
  brand:   'bg-brand-500/10 text-brand-300 border-brand-500/40',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  danger:  'bg-red-500/10 text-red-300 border-red-500/40',
  info:    'bg-sky-500/10 text-sky-300 border-sky-500/40',
  violet:  'bg-violet-500/10 text-violet-300 border-violet-500/40',
}

const dotColors: Record<PillTone, string> = {
  neutral: 'bg-slate-400',
  brand:   'bg-brand-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-red-400',
  info:    'bg-sky-400',
  violet:  'bg-violet-400',
}

/**
 * Etiqueta/badge padronizada pra status e tags.
 * Sempre arredondada total, borda sutil, texto pequeno.
 */
export default function Pill({ tone = 'neutral', dot = false, children, className = '' }: Props) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ' +
        tones[tone] +
        ' ' +
        className
      }
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[tone]}`} />}
      {children}
    </span>
  )
}
