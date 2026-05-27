import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Paleta unica do app:
// - primary  : brand (azul corporativo) — acoes principais (+ Novo, Salvar, Confirmar)
// - secondary: slate sutil — acoes alternativas (Cancelar, filtros, "Mostrar X")
// - danger   : vermelho solido — acoes destrutivas (Apagar, Remover)
// - ghost    : sem fundo — acoes auxiliares (← Voltar, links discretos)
const styles: Record<Variant, string> = {
  primary:
    'bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold border border-brand-700',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
  danger:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold border border-red-600',
  ghost:
    'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
