interface Props {
  titulo: string
  descricao: string
  hint?: string
}

/**
 * Placeholder pra importações em massa que ainda não foram implementadas.
 * Mostra o card visual padrão; o upload real entra em fase posterior.
 */
export default function ImportPlaceholder({ titulo, descricao, hint }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100">{titulo}</div>
          <p className="text-xs text-slate-400 mt-1">{descricao}</p>
          {hint && (
            <p className="text-[11px] text-slate-500 mt-2 italic">{hint}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Em breve
        </span>
      </div>
    </div>
  )
}
