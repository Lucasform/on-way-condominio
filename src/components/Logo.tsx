import { useId } from 'react'

interface Props {
  size?: number
  color?: string
  className?: string
}

export default function Logo({ size = 48, color = '#e8a838', className = '' }: Props) {
  const uid = useId()
  const maskId = `logo-mask-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OnWay Condomínio"
    >
      <defs>
        <mask id={maskId}>
          <rect x="26.4" y="40.8" width="67.2" height="45.6" rx="2" fill="white" />
          <circle cx="60" cy="75.6" r="13.2" fill="black" />
        </mask>
      </defs>

      {/* Telhado */}
      <path d="M60 2.4L97.4123 36.6H22.5877L60 2.4Z" fill={color} />

      {/* Corpo com recorte circular para o pin (fundo aparece através) */}
      <rect
        x="26.4" y="40.8" width="67.2" height="45.6" rx="2"
        fill={color} fillOpacity="0.85"
        mask={`url(#${maskId})`}
      />

      {/* Pin — anel */}
      <circle cx="60" cy="75.6" r="13.2" fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="2.5" />

      {/* Pin — ponto */}
      <circle cx="60" cy="75.6" r="6" fill={color} />
    </svg>
  )
}
