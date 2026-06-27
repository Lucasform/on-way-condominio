import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Mostra spinner e desabilita o botão. */
  loading?: boolean
  /** Ícone à esquerda do texto. */
  leftIcon?: ReactNode
  /** Ícone à direita do texto. */
  rightIcon?: ReactNode
  /** Ocupa toda a largura do container. */
  full?: boolean
}

// Paleta única do app:
// - primary  : brand sólido — ação principal de cada tela
// - secondary: slate borda — alternativa sem peso (Cancelar, filtros)
// - danger   : vermelho sólido — destrutivo (Apagar, Remover)
// - ghost    : sem fundo, hover sutil — link de ação (← Voltar)
// - outline  : borda brand, hover preenche — call to action secundário
const styles: Record<Variant, string> = {
  primary:
    'bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold ' +
    'border border-brand-700 shadow-sm shadow-brand-900/20 ' +
    'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
  secondary:
    'bg-slate-800/60 hover:bg-slate-700/70 text-slate-100 ' +
    'border border-slate-700 hover:border-slate-600 ' +
    'focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
  danger:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold ' +
    'border border-red-600 shadow-sm shadow-red-900/20 ' +
    'focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
  ghost:
    'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 ' +
    'border border-transparent ' +
    'focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
  outline:
    'bg-transparent text-brand-300 hover:bg-brand-700/15 hover:text-brand-200 ' +
    'border border-brand-600/50 hover:border-brand-500 font-medium ' +
    'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 sm:h-7 px-2.5 text-xs gap-1.5',
  md: 'h-11 sm:h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  full = false,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  const isDisabled = disabled || loading
  return (
    <button
      disabled={isDisabled}
      className={
        'inline-flex items-center justify-center rounded-md font-medium ' +
        'transition-colors transition-shadow ' +
        'outline-none ' +
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ' +
        (full ? 'w-full ' : '') +
        sizes[size] + ' ' +
        styles[variant] + ' ' +
        className
      }
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children && <span className="truncate">{children}</span>}
      {!loading && rightIcon}
    </button>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
