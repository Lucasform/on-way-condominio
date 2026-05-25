import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const styles: Record<Variant, string> = {
  primary:
    'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
  danger:
    'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30',
  ghost:
    'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
}

export default function Button({
  variant = 'primary',
  className = '',
  ...rest
}: Props) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
