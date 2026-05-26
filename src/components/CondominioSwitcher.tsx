import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

interface CondoOpt {
  condominio_id: string
  role: string
  nome: string
}

export default function CondominioSwitcher() {
  const { perfil, refreshPerfil } = useAuth()
  const [opts, setOpts] = useState<CondoOpt[]>([])
  const [trocando, setTrocando] = useState(false)

  useEffect(() => {
    if (!perfil || perfil.role === 'admin_onway') return
    let mounted = true
    ;(async () => {
      const { data: pcs } = await supabase
        .from('perfis_condominios')
        .select('condominio_id, role')
        .eq('perfil_id', perfil.id)
        .eq('ativo', true)
      if (!pcs?.length) return
      const ids = pcs.map((p) => p.condominio_id)
      const { data: condos } = await supabase
        .from('condominios')
        .select('id, nome')
        .in('id', ids)
      if (!mounted) return
      const merged: CondoOpt[] = pcs.map((pc) => ({
        condominio_id: pc.condominio_id,
        role: pc.role,
        nome: condos?.find((c) => c.id === pc.condominio_id)?.nome ?? '—',
      }))
      setOpts(merged)
    })()
    return () => { mounted = false }
  }, [perfil])

  if (!perfil || opts.length < 2) return null

  async function trocar(condoId: string) {
    if (condoId === perfil!.condominio_id) return
    setTrocando(true)
    try {
      const { error } = await supabase.rpc('set_active_condominio', { p_condominio: condoId })
      if (error) throw error
      await refreshPerfil()
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao trocar.')
    } finally {
      setTrocando(false)
    }
  }

  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
      <label className="block text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500 mb-1">
        Condomínio ativo
      </label>
      <select
        value={perfil.condominio_id ?? ''}
        onChange={(e) => trocar(e.target.value)}
        disabled={trocando}
        className="w-full text-xs px-2 py-1.5 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
      >
        {opts.map((o) => (
          <option key={o.condominio_id} value={o.condominio_id}>
            {o.nome} ({o.role})
          </option>
        ))}
      </select>
    </div>
  )
}
