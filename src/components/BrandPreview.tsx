import { useMemo } from 'react'
import { gerarPaletaBrand } from '../lib/tenant'

interface Props {
  cor: string | null
  nome: string
  logoUrl: string | null
}

const TOMS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/**
 * Mostra como o app vai parecer com a cor escolhida.
 * Usa CSS vars locais (scope inline style) pra nao mexer no tema global.
 */
export default function BrandPreview({ cor, nome, logoUrl }: Props) {
  const paleta = useMemo(() => gerarPaletaBrand(cor), [cor])

  if (!paleta) {
    return (
      <div className="text-xs text-slate-500 italic">
        Defina uma cor primária pra ver a prévia.
      </div>
    )
  }

  // Aplica vars apenas neste container
  const vars: Record<string, string> = {}
  for (const tom of TOMS) vars[`--brand-${tom}`] = paleta[tom]

  return (
    <div className="space-y-3" style={vars as React.CSSProperties}>
      <div className="text-xs font-medium text-slate-300">Pré-visualização</div>

      {/* Mini header */}
      <div className="rounded-lg overflow-hidden border border-slate-700">
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: `rgb(${paleta[800]})` }}
        >
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-7 w-7 rounded bg-white/10 object-contain" />
            ) : (
              <div className="h-7 w-7 rounded bg-white/15" />
            )}
            <span className="text-white font-semibold text-sm">{nome || 'Condomínio'}</span>
          </div>
          <div className="text-white/70 text-xs">Olá, morador</div>
        </div>

        {/* Conteudo simulado */}
        <div className="bg-slate-950 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="px-2 py-0.5 rounded font-medium"
              style={{ background: `rgb(${paleta[600]} / 0.15)`, color: `rgb(${paleta[300]})`, border: `1px solid rgb(${paleta[600]} / 0.4)` }}
            >
              Etiqueta
            </span>
            <span className="text-slate-400">Card de exemplo</span>
          </div>
          <div
            className="rounded-md p-3 border"
            style={{ borderColor: `rgb(${paleta[700]} / 0.4)`, background: `rgb(${paleta[800]} / 0.08)` }}
          >
            <div className="text-sm text-slate-100 font-medium">Aviso da administração</div>
            <div className="text-xs text-slate-400 mt-1">
              Exemplo de como uma notificação aparece no app dos moradores.
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-white text-sm font-semibold"
              style={{ background: `rgb(${paleta[700]})` }}
            >
              Botão principal
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-sm font-medium border"
              style={{
                borderColor: `rgb(${paleta[600]} / 0.5)`,
                color: `rgb(${paleta[300]})`,
                background: 'transparent',
              }}
            >
              Secundário
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
