export interface TabItem {
  key: string
  label: string
  icon?: string
  count?: number
}

/**
 * Abas padrão do app: linha com sublinhado no item ativo, rolável no mobile.
 * Use em qualquer tela que filtre por categoria/seção pra manter consistência.
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: TabItem[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={`flex gap-1 border-b border-slate-800 overflow-x-auto ${className}`}>
      {tabs.map((t) => {
        const ativo = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`relative shrink-0 rounded-t-md px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
              ativo
                ? 'border-brand-500 text-slate-100 font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {t.icon && <span className="mr-1.5">{t.icon}</span>}
            {t.label}
            {typeof t.count === 'number' && (
              <span className={`ml-1.5 text-xs ${ativo ? 'text-brand-300' : 'text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
