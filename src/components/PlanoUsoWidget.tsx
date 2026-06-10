import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

interface Uso {
  condominio_id: string
  nome: string
  plano: string
  unidades_atual: number
  unidades_max: number
  pessoas_atual: number
  pessoas_max: number
  usuarios_atual: number
  usuarios_max: number
}

export default function PlanoUsoWidget() {
  const { perfil } = useAuth()
  const [uso, setUso] = useState<Uso | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!perfil?.condominio_id) { setLoading(false); return }
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('condominio_uso')
        .select('*')
        .eq('condominio_id', perfil.condominio_id!)
        .maybeSingle()
      if (mounted) { setUso(data as Uso | null); setLoading(false) }
    })()
    return () => { mounted = false }
  }, [perfil])

  if (loading || !uso) return null

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-100">Uso do plano</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-brand-700/10 text-brand-300 border border-brand-700/20 uppercase font-medium">
          {uso.plano}
        </span>
      </div>
      <div className="space-y-3">
        <Bar label="Unidades" atual={uso.unidades_atual} max={uso.unidades_max} />
        <Bar label="Pessoas" atual={uso.pessoas_atual} max={uso.pessoas_max} />
        <Bar label="Usuários" atual={uso.usuarios_atual} max={uso.usuarios_max} />
      </div>
    </section>
  )
}

function Bar({ label, atual, max }: { label: string; atual: number; max: number }) {
  const pct = Math.min(100, (atual / max) * 100)
  const danger = pct >= 90
  const warn = pct >= 75
  const color = danger ? 'bg-red-600' : warn ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className={`tabular-nums ${danger ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
          {atual} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
