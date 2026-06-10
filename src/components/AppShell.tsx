import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { bottomNavFor, iconFor } from '../lib/nav'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'
import BottomNav from './BottomNav'
import Logo from './Logo'
import AccountMenu from './AccountMenu'
import { prefetchRoutes } from '../lib/prefetchRoutes'

export default function AppShell() {
  const { perfil, user, effectiveRole } = useAuth()

  // Links rápidos no topo (desktop): os mesmos primários da barra inferior.
  const quickLinks = effectiveRole
    ? bottomNavFor(effectiveRole).filter((i) => i.to !== '/mais')
    : []

  // Unidade do usuário (contexto no header mobile)
  const [unidadeLabel, setUnidadeLabel] = useState<string | null>(null)
  useEffect(() => {
    if (!user) { setUnidadeLabel(null); return }
    supabase
      .from('pessoas')
      .select('unidades:unidade_id(bloco, numero)')
      .eq('user_id', user.id)
      .not('unidade_id', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const u = (data as { unidades?: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null } | null)?.unidades
        const uf = Array.isArray(u) ? u[0] : u
        setUnidadeLabel(uf ? (uf.bloco ? `${uf.bloco}-${uf.numero}` : uf.numero) : null)
      })
  }, [user])

  const [condoLogo, setCondoLogo] = useState<string | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)

  useEffect(() => { prefetchRoutes() }, [])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoLogo(null); setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome, logo_url').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) { setCondoLogo(data.logo_url); setCondoNome(data.nome) } })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  async function handleExitViewAs() {
    await supabase.rpc('exit_view_as')
    window.location.href = '/'
  }

  const emViewAs = perfil?.role === 'admin_onway' && perfil.condominio_id

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top bar — único nível de navegação fixa (sem sidebar) */}
      <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur flex items-center px-3 md:px-5 gap-3 sticky top-0 z-40">
        {/* Logo + condomínio (clica e volta pro início) */}
        <NavLink to="/" className="flex items-center gap-2.5 min-w-0 shrink-0">
          {condoLogo ? (
            <img src={condoLogo} alt="" className="w-8 h-8 object-contain rounded shrink-0" />
          ) : (
            <Logo size={30} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
              {condoNome ?? 'OnWay'}
            </div>
            {unidadeLabel && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Un. {unidadeLabel}</div>
            )}
          </div>
        </NavLink>

        {/* Atalhos (desktop) */}
        <nav className="hidden md:flex items-center gap-1 ml-4 flex-1">
          {quickLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`
              }
            >
              <span className="text-base leading-none">{iconFor(item.to)}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 md:hidden" />
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <AccountMenu />
        </div>
      </header>

      {emViewAs && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-amber-700 dark:text-amber-300">
            👁 Você está em modo "Ver como". Assumiu o condomínio <strong>{condoNome ?? '...'}</strong> como Administrador OnWay.
          </span>
          <button
            onClick={handleExitViewAs}
            className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-200 font-medium whitespace-nowrap"
          >
            ← Voltar pra visão global
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-16 md:pb-0">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
