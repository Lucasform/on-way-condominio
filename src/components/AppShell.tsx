import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel } from '../lib/nav'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'
import CondominioSwitcher from './CondominioSwitcher'
import { prefetchRoutes } from '../lib/prefetchRoutes'

export default function AppShell() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const items = perfil ? menuFor(perfil.role) : []
  const [condoLogo, setCondoLogo] = useState<string | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)

  useEffect(() => {
    prefetchRoutes()
  }, [])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoLogo(null); setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome, logo_url').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) { setCondoLogo(data.logo_url); setCondoNome(data.nome) } })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleExitViewAs() {
    await supabase.rpc('exit_view_as')
    window.location.href = '/'
  }

  const emViewAs = perfil?.role === 'admin_onway' && perfil.condominio_id

  return (
    <div className="min-h-screen bg-brand-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          {condoLogo ? (
            <img src={condoLogo} alt={condoNome ?? ''} className="w-9 h-9 object-contain rounded" />
          ) : (
            <Logo size={36} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">
              {condoNome ? (
                <span className="text-slate-900 dark:text-slate-100">{condoNome}</span>
              ) : (
                <span className="text-brand-700 dark:text-brand-400">OnWay</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {condoNome ? 'via OnWay Condomínio' : 'Condomínio'}
            </div>
          </div>
        </div>

        {perfil && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
            {roleLabel(perfil.role)}
          </div>
        )}

        <CondominioSwitcher />

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? 'bg-brand-100 dark:bg-brand-700/20 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
          <div className="text-xs text-slate-500 truncate" title={user?.email ?? ''}>
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {emViewAs && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-amber-700 dark:text-amber-300">
              👁 Você está em modo "Ver como" — assumiu o condomínio <strong>{condoNome ?? '...'}</strong> como Administrador OnWay.
            </span>
            <button
              onClick={handleExitViewAs}
              className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-200 font-medium whitespace-nowrap"
            >
              ← Voltar pra visão global
            </button>
          </div>
        )}
        <header className="h-12 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 flex items-center justify-end px-4 gap-1">
          <ThemeToggle compact />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-brand-50/40 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
