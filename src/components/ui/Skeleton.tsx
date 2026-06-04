interface SkeletonProps {
  className?: string
  count?: number
}

/**
 * Bloco animado pra placeholder de loading.
 * - Use direto: <Skeleton className="h-4 w-32" />
 * - Use repetido: <Skeleton count={5} className="h-12 mb-2" />
 */
export default function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  if (count === 1) {
    return <div className={`animate-pulse rounded-md bg-slate-800/60 ${className}`} />
  }
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`animate-pulse rounded-md bg-slate-800/60 ${className}`} />
      ))}
    </>
  )
}

/** Skeleton padrão pra lista de cards (rounded-lg p-4 com altura variável). */
export function CardListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-800 rounded w-2/3" />
            <div className="h-3 bg-slate-800/60 rounded w-1/3" />
            <div className="h-3 bg-slate-800/60 rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton padrão pra página de detalhe (header + card com seções). */
export function DetailSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-40 bg-slate-800 rounded animate-pulse" />
        <div className="h-9 w-24 bg-slate-800/60 rounded animate-pulse" />
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-2/3 bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-slate-800/60 rounded animate-pulse" />
          </div>
          <div className="h-7 w-24 bg-slate-800/60 rounded animate-pulse" />
        </div>
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <div className="h-3 w-20 bg-slate-800/60 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-800/60 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-slate-800/60 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-800/60 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton padrão pra tabela. */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-800 rounded animate-pulse flex-1" />
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-t border-slate-800/60 px-4 py-3 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 bg-slate-800/60 rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
