import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import Button from './ui/Button'
import Pill from './ui/Pill'

interface VincCondo {
  condominio_id: string
  role: string
  ativo: boolean
  nome: string
}

/**
 * Mostra todos os condomínios em que o usuário tem vínculo (perfis_condominios).
 * Permite alternar o condomínio ativo. Admin OnWay vê tudo dos seus vínculos
 * (caso ele crie pra si mesmo); demais perfis veem seus N condos.
 */
export default function MeusCondominios() {
  const { perfil, refreshPerfil } = useAuth()
  const [vincs, setVincs] = useState<VincCondo[]>([])
  const [trocando, setTrocando] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!perfil) return
    setLoading(true)
    const { data: pcs } = await supabase
      .from('perfis_condominios')
      .select('condominio_id, role, ativo')
      .eq('perfil_id', perfil.id)
    if (pcs && pcs.length) {
      const ids = pcs.map((p) => p.condominio_id)
      const { data: condos } = await supabase
        .from('condominios')
        .select('id, nome')
        .in('id', ids)
      const merged: VincCondo[] = pcs.map((pc) => ({
        condominio_id: pc.condominio_id,
        role: pc.role,
        ativo: pc.ativo,
        nome: condos?.find((c) => c.id === pc.condominio_id)?.nome ?? '—',
      }))
      setVincs(merged.sort((a, b) => a.nome.localeCompare(b.nome)))
    } else {
      setVincs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id])

  async function trocarAtivo(condoId: string) {
    if (condoId === perfil?.condominio_id) return
    setTrocando(condoId)
    try {
      const { error } = await supabase.rpc('set_active_condominio', { p_condominio: condoId })
      if (error) throw error
      await refreshPerfil()
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao trocar.')
      setTrocando(null)
    }
  }

  if (!perfil || perfil.role === 'admin_onway') return null
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-500">
        Carregando seus condomínios...
      </section>
    )
  }
  if (vincs.length === 0) return null

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-200">🏢 Meus condomínios</h3>
        <span className="text-xs text-slate-500">({vincs.length})</span>
      </div>
      <ul className="space-y-2">
        {vincs.map((v) => {
          const isAtivo = v.condominio_id === perfil.condominio_id
          return (
            <li
              key={v.condominio_id}
              className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                isAtivo ? 'border-brand-500/40 bg-brand-700/10' : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100">{v.nome}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex gap-1.5 items-center">
                  <Pill tone={isAtivo ? 'brand' : 'neutral'} dot={isAtivo}>
                    {isAtivo ? 'Em uso agora' : 'Disponível'}
                  </Pill>
                  <span className="capitalize">{v.role}</span>
                </div>
              </div>
              {!isAtivo && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => trocarAtivo(v.condominio_id)}
                  loading={trocando === v.condominio_id}
                >
                  Acessar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {vincs.length === 1 && (
        <div className="mt-3 text-xs text-slate-500">
          Pra cuidar de mais de um condomínio, peça à administração OnWay um novo código de convite com o condomínio adicional.
        </div>
      )}
    </section>
  )
}
