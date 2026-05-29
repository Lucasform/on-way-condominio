import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOcorrencias } from '../lib/ocorrencias'
import { listUnidades } from '../lib/unidades'
import type { Unidade } from '../types/unidade'

interface Hotspot {
  chave: string
  label: string
  count: number
  dimensao: 'bloco' | 'unidade' | 'local'
  ultimosDias: number
  alvo?: string
}

const JANELA_DIAS = 60
const LIMITE_BLOCO = 3
const LIMITE_UNIDADE = 3
const LIMITE_LOCAL = 4

export default function HotspotsPanel({ condominioId }: { condominioId: string }) {
  const [hotspots, setHotspots] = useState<Hotspot[] | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const corte = new Date(Date.now() - JANELA_DIAS * 86400_000)
        const [ocorrs, unidades] = await Promise.all([
          listOcorrencias({ condominio_id: condominioId }),
          listUnidades({ condominio_id: condominioId, ativo: true }),
        ])
        const unidadesMap = new Map<string, Unidade>()
        for (const u of unidades) unidadesMap.set(u.id, u)

        const recentes = ocorrs.filter((o) => new Date(o.created_at) >= corte)

        const porBloco = new Map<string, number>()
        const porUnidade = new Map<string, { count: number; label: string }>()
        const porLocal = new Map<string, number>()

        for (const o of recentes) {
          const u = o.unidade_id ? unidadesMap.get(o.unidade_id) : null
          if (u?.bloco) porBloco.set(u.bloco, (porBloco.get(u.bloco) ?? 0) + 1)
          if (u) {
            const label = u.bloco ? `${u.bloco}-${u.numero}` : u.numero
            const cur = porUnidade.get(o.unidade_id!) ?? { count: 0, label }
            porUnidade.set(o.unidade_id!, { count: cur.count + 1, label })
          }
          if (o.local) {
            const key = o.local.toLowerCase().trim()
            porLocal.set(key, (porLocal.get(key) ?? 0) + 1)
          }
        }

        const out: Hotspot[] = []
        for (const [bloco, count] of porBloco.entries()) {
          if (count >= LIMITE_BLOCO) {
            out.push({
              chave: `bloco:${bloco}`,
              label: `Bloco ${bloco}`,
              count,
              dimensao: 'bloco',
              ultimosDias: JANELA_DIAS,
            })
          }
        }
        for (const [id, { count, label }] of porUnidade.entries()) {
          if (count >= LIMITE_UNIDADE) {
            out.push({
              chave: `unidade:${id}`,
              label: `Unidade ${label}`,
              count,
              dimensao: 'unidade',
              ultimosDias: JANELA_DIAS,
              alvo: `/unidades/${id}/historico`,
            })
          }
        }
        for (const [local, count] of porLocal.entries()) {
          if (count >= LIMITE_LOCAL) {
            out.push({
              chave: `local:${local}`,
              label: capitalizar(local),
              count,
              dimensao: 'local',
              ultimosDias: JANELA_DIAS,
            })
          }
        }

        // Ordena por count desc
        out.sort((a, b) => b.count - a.count)

        if (mounted) setHotspots(out)
      } catch (e) {
        console.warn('[hotspots] falha:', e)
        if (mounted) setHotspots([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [condominioId])

  if (!hotspots) return null
  if (hotspots.length === 0) return null

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-300">🔥</span>
        <h3 className="text-sm font-semibold text-amber-200">
          Pontos de atenção
        </h3>
        <span className="text-xs text-slate-400">últimos {JANELA_DIAS} dias</span>
      </div>
      <ul className="space-y-2">
        {hotspots.slice(0, 6).map((h) => {
          const body = (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm hover:border-slate-600 transition">
              <span className="text-slate-200">
                <span className="text-xs text-slate-500 uppercase tracking-wide mr-2">
                  {h.dimensao}
                </span>
                {h.label}
              </span>
              <span className="text-xs text-amber-300 font-medium">
                {h.count} ocorrências
              </span>
            </div>
          )
          return (
            <li key={h.chave}>
              {h.alvo ? <Link to={h.alvo}>{body}</Link> : body}
            </li>
          )
        })}
      </ul>
      {hotspots.length > 6 && (
        <div className="text-xs text-slate-500 mt-2">
          + {hotspots.length - 6} outros pontos.
        </div>
      )}
    </section>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
