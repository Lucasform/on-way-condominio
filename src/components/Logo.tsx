interface Props {
  size?: number
  withText?: boolean
  className?: string
}

/**
 * Logo OnWay Condomínio — prédios estilizados em formato circular.
 * Identidade visual em índigo profissional (cor de marca: brand-700 = #4338CA).
 */
export default function Logo({ size = 48, withText = false, className = '' }: Props) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="OnWay Condomínio"
      >
        {/* Fundo circular */}
        <circle cx="50" cy="50" r="48" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-700/40" />

        {/* Prédios — índigo */}
        <g fill="currentColor" className="text-brand-700">
          {/* Prédio esquerdo (médio) */}
          <rect x="22" y="42" width="16" height="38" rx="1" />
          {/* Janelas esquerdo */}
          <rect x="26" y="48" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="32" y="48" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="26" y="55" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="32" y="55" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="26" y="62" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="32" y="62" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="26" y="69" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="32" y="69" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />

          {/* Prédio central (alto) */}
          <rect x="42" y="22" width="18" height="58" rx="1" />
          {/* Topo angular */}
          <polygon points="42,22 51,15 60,22" />
          {/* Janelas centro */}
          <rect x="46" y="30" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="30" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="37" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="37" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="44" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="44" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="51" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="51" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="58" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="58" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="65" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="65" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="46" y="72" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="53" y="72" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />

          {/* Prédio direito (baixo) */}
          <rect x="64" y="52" width="14" height="28" rx="1" />
          <rect x="67" y="58" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="73" y="58" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="67" y="65" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="73" y="65" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="67" y="72" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />
          <rect x="73" y="72" width="3" height="3" fill="currentColor" className="text-brand-50 dark:text-slate-900" />

          {/* Base curva */}
          <path d="M 10 78 Q 50 88 90 78 L 90 86 Q 50 96 10 86 Z" />
        </g>
      </svg>

      {withText && (
        <span className="font-bold text-lg tracking-tight">
          <span className="text-brand-400">OnWay</span>
          <span className="text-slate-300"> Condomínio</span>
        </span>
      )}
    </div>
  )
}
