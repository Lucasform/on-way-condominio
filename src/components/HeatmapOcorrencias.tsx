import { useEffect, useState } from 'react'
import { getHeatmapOcorrencias, formatSemanaLabel, type HeatmapData } from '../lib/kpis'

/**
 * Heatmap de ocorrencias por bloco x semana, ultimos N dias.
 * Cor por intensidade relativa (max do periodo).
 */
export default function HeatmapOcorrencias({
  condominio_id,
  dias = 90,
}: {
  condominio_id?: string
  dias?: number
}) {
  const [data, setData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    getHeatmapOcorrencias({ condominio_id, dias })
      .then((d) => { if (!cancel) setData(d) })
      .catch((e) => { if (!cancel) setError(e instanceof Error ? e.message : 'Erro ao carregar.') })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [condominio_id, dias])

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-100">
          Heatmap de ocorrências por bloco
        </h3>
        <span className="text-xs text-slate-500">
          últimos {dias} dias{data ? ` · ${data.total} ocorrências` : ''}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : !data || data.blocos.length === 0 || data.semanas.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-slate-500">
          Sem ocorrências no período.
        </div>
      ) : (
        <Heatmap data={data} />
      )}
    </div>
  )
}

function Heatmap({ data }: { data: HeatmapData }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px] text-[10px] sm:text-xs">
        <thead>
          <tr>
            <th className="text-left text-slate-500 pr-2 font-normal">Bloco \\ Semana</th>
            {data.semanas.map((s) => (
              <th key={s} className="text-slate-400 font-normal align-bottom">
                <div className="rotate-[-45deg] origin-left whitespace-nowrap pl-2 h-10 text-[10px]">
                  {formatSemanaLabel(s)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.blocos.map((b) => (
            <tr key={b}>
              <td className="text-slate-300 pr-2 text-xs whitespace-nowrap font-medium">{b}</td>
              {data.semanas.map((s) => {
                const v = data.matrix[b]?.[s] ?? 0
                return (
                  <td key={s} className="p-0">
                    <Cell value={v} max={data.max} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <Legenda max={data.max} />
    </div>
  )
}

function Cell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  const bg = cellColor(intensity, value)
  return (
    <div
      title={value > 0 ? `${value} ocorrência${value > 1 ? 's' : ''}` : 'sem ocorrências'}
      className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[10px] font-medium ${bg}`}
    >
      {value > 0 ? value : ''}
    </div>
  )
}

function cellColor(intensity: number, value: number): string {
  // sem valor = cinza muito sutil
  if (value === 0) return 'bg-slate-800/40 text-slate-700'
  // escala vermelha (poluicao = problema)
  if (intensity > 0.85) return 'bg-red-500 text-white'
  if (intensity > 0.65) return 'bg-red-500/80 text-white'
  if (intensity > 0.45) return 'bg-amber-500/70 text-white'
  if (intensity > 0.25) return 'bg-amber-400/60 text-slate-900'
  return 'bg-amber-300/40 text-slate-900'
}

function Legenda({ max }: { max: number }) {
  if (max <= 0) return null
  const steps = [0.2, 0.4, 0.6, 0.8, 1.0]
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
      <span>menos</span>
      <div className="flex gap-[2px]">
        {steps.map((s) => (
          <div
            key={s}
            className={`w-4 h-4 rounded ${cellColor(s, 1)}`}
          />
        ))}
      </div>
      <span>mais</span>
      <span className="ml-3 text-slate-600">(máx por semana: {max})</span>
    </div>
  )
}
