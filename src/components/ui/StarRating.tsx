interface Props {
  value: number             // 0 a 5
  total?: number            // quantas avaliações
  size?: 'sm' | 'md'
  onChange?: (v: number) => void  // se passado, vira input
  className?: string
}

const STARS = [1, 2, 3, 4, 5]

export default function StarRating({ value, total, size = 'sm', onChange, className }: Props) {
  const interactive = !!onChange
  const px = size === 'md' ? 'text-lg' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-0.5 ${px} ${className ?? ''}`}>
      {STARS.map((n) => {
        const fill = value >= n
        const half = !fill && value > n - 1 && value < n
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            className={`leading-none ${interactive ? 'cursor-pointer hover:scale-110 transition' : 'cursor-default'} ${
              fill ? 'text-amber-400' : half ? 'text-amber-400/60' : 'text-slate-600'
            }`}
            title={interactive ? `Dar ${n} estrelas` : undefined}
          >
            ★
          </button>
        )
      })}
      {typeof total === 'number' && (
        <span className="ml-1 text-xs text-slate-400">
          {value > 0 ? value.toFixed(1) : '—'} {total > 0 && <>({total})</>}
        </span>
      )}
    </span>
  )
}
