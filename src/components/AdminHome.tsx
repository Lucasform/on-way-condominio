import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { traduzErro } from '../lib/errorMessages'

interface CondoUso {
  condominio_id: string
  nome: string
  plano: string
  unidades_atual: number
  unidades_max: number
  pessoas_atual: number
  pessoas_max: number
  usuarios_atual: number
  usuarios_max: number
  logo_url?: string | null
}

export default function AdminHome() {
  const { perfil, refreshPerfil, user } = useAuth()
  const [condos, setCondos] = useState<CondoUso[]>([])
  const [loading, setLoading] = useState(true)
  const [trocando, setTrocando] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: uso } = await supabase.from('condominio_uso').select('*').order('nome')
      const { data: meta } = await supabase.from('condominios').select('id, logo_url')
      if (!mounted) return
      const merged = (uso ?? []).map((u) => ({
        ...(u as CondoUso),
        logo_url: meta?.find((m) => m.id === u.condominio_id)?.logo_url ?? null,
      }))
      setCondos(merged)
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  async function assumir(condoId: string) {
    setTrocando(condoId)
    const { error } = await supabase.rpc('set_active_condominio', { p_condominio: condoId })
    if (error) {
      alert(traduzErro(error))
      setTrocando(null)
      return
    }
    await refreshPerfil()
    window.location.href = '/'
  }

  async function sairViewAs() {
    setTrocando('exit')
    const { error } = await supabase.rpc('exit_view_as')
    if (error) {
      alert(traduzErro(error))
      setTrocando(null)
      return
    }
    await refreshPerfil()
    window.location.href = '/'
  }

  // Se admin já está em view-as, redireciona pra Home do condomínio
  // (mas com banner indicando)
  const emViewAs = !!perfil?.condominio_id

  return (
    <div className="px-8 py-10 max-w-6xl">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-700 dark:text-brand-400">
            Administrador OnWay
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {emViewAs
              ? `Você está vendo o condomínio "${condos.find((c) => c.condominio_id === perfil?.condominio_id)?.nome ?? '...'}". Volte pra visão global ou troque.`
              : `Logado como ${user?.email}. Escolha um condomínio pra entrar ou veja métricas globais.`}
          </p>
        </div>
        {emViewAs && (
          <button
            onClick={sairViewAs}
            disabled={trocando !== null}
            className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            ← Voltar pra visão global
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          to="/condominios"
          className="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          🏢 Gerenciar condomínios
        </Link>
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          📊 Dashboard global
        </Link>
        <Link
          to="/auditoria"
          className="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          📋 Auditoria
        </Link>
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
        Condomínios ({condos.length})
      </h2>

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : condos.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/40">
          <p className="text-slate-600 dark:text-slate-400">Nenhum condomínio cadastrado ainda.</p>
          <Link
            to="/condominios/novo"
            className="mt-3 inline-block px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium"
          >
            + Cadastrar primeiro condomínio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {condos.map((c) => {
            const ativo = c.condominio_id === perfil?.condominio_id
            return (
              <div
                key={c.condominio_id}
                className={`rounded-lg border ${ativo ? 'border-brand-700 ring-1 ring-brand-700' : 'border-slate-200 dark:border-slate-800'} bg-white dark:bg-slate-900/40 p-4 flex flex-col gap-3 hover:border-brand-500 dark:hover:border-brand-700 transition`}
              >
                <div className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="w-12 h-12 rounded object-contain bg-slate-50 dark:bg-slate-800 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-brand-50 dark:bg-brand-700/20 flex items-center justify-center text-brand-700 dark:text-brand-400 text-xl">🏢</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.nome}</div>
                    <div className="text-xs text-slate-500 uppercase">Plano {c.plano}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Unid." val={c.unidades_atual} max={c.unidades_max} />
                  <Stat label="Pessoas" val={c.pessoas_atual} max={c.pessoas_max} />
                  <Stat label="Users" val={c.usuarios_atual} max={c.usuarios_max} />
                </div>

                <div className="flex gap-2 pt-2 mt-auto">
                  <button
                    onClick={() => assumir(c.condominio_id)}
                    disabled={trocando !== null || ativo}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition ${
                      ativo
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default'
                        : 'bg-brand-700 hover:bg-brand-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {ativo ? '✓ Em uso' : trocando === c.condominio_id ? '...' : 'Entrar nesse condomínio'}
                  </button>
                  <Link
                    to={`/condominios/${c.condominio_id}`}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    ⚙
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, val, max }: { label: string; val: number; max: number }) {
  const pct = (val / max) * 100
  const danger = pct >= 90
  return (
    <div>
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`font-mono ${danger ? 'text-red-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
        {val}/{max}
      </div>
    </div>
  )
}
