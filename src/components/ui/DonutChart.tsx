export interface DonutSegment { label: string; value: number; color: string }

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
}

export default function DonutChart({ segments, size = 72, thickness = 13 }: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null

  const cx = size / 2
  const cy = size / 2
  const r = cx - thickness / 2

  let startAngle = -Math.PI / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {segments.map((seg, i) => {
        if (seg.value === 0) return null
        const angle = (seg.value / total) * 2 * Math.PI
        // Clamp to avoid full-circle arc (renders as nothing)
        const endAngle = startAngle + Math.min(angle, 2 * Math.PI - 0.0001)
        const x1 = cx + r * Math.cos(startAngle)
        const y1 = cy + r * Math.sin(startAngle)
        const x2 = cx + r * Math.cos(endAngle)
        const y2 = cy + r * Math.sin(endAngle)
        const largeArc = angle > Math.PI ? 1 : 0
        const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
        startAngle = endAngle
        return <path key={i} d={d} fill="none" stroke={seg.color} strokeWidth={thickness} strokeLinecap="butt" />
      })}
    </svg>
  )
}
