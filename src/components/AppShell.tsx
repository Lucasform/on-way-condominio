import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel, isGroup } from '../lib/nav'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'
import Logo from './Logo'
import CondominioSwitcher from './CondominioSwitcher'
import { prefetchRoutes } from '../lib/prefetchRoutes'

export default function AppShell() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = perfil ? menuFor(perfil.role) : []
  const [condoLogo, setCondoLogo] = useState<string | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    prefetchRoutes()
  }, [])

  // Fecha o drawer ao navegar
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Bloqueia scroll do body quando o drawer está aberto (mobile)
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [mobileOpen])

  // ESC fecha o drawer
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoLogo(null); setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome, logo_url').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) { setCondoLogo(data.logo_url); setCondoNome(data.nome) } })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  async function handleSignOut() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  async function handleExitViewAs() {
    await supabase.rpc('exit_view_as')
    window.location.href = '/'
  }

  const emViewAs = perfil?.role === 'admin_onway' && perfil.condominio_id

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          w-72 md:w-60 shrink-0 border-r border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900 md:dark:bg-slate-900/40 flex flex-col
          fixed md:static inset-y-0 left-0 z-50
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        aria-label="Navegação principal"
      >
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          {condoLogo ? (
            <img src={condoLogo} alt={condoNome ?? ''} className="w-9 h-9 object-contain rounded" />
          ) : (
            <Logo size={36} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate text-slate-900 dark:text-slate-100">
              {condoNome ?? 'OnWay'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {condoNome ? 'via OnWay Condomínio' : 'Condomínio'}
            </div>
          </div>
        </div>

        {perfil && (
          <Link
            to="/meu-perfil"
            title="Editar meu perfil"
            className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
          >
            <ProfileAvatar perfil={perfil} email={user?.email ?? null} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                {perfil.nome_exibicao ?? user?.email ?? 'Sem nome'}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500 truncate">
                {roleLabel(perfil.role)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition shrink-0">
              ✎
            </span>
          </Link>
        )}

        <CondominioSwitcher />

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((item, idx) => {
            if (isGroup(item)) {
              return (
                <div key={`g-${idx}-${item.label}`} className="pt-3 pb-1">
                  <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                    {item.label}
                  </div>
                  <div className="space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-md text-sm transition ${
                            isActive
                              ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm transition ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <button
            onClick={handleSignOut}
            title={user?.email ?? 'Sair'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <SignOutIcon />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar mobile (hamburger + nome + sino) */}
        <header className="md:hidden h-12 shrink-0 border-b border-slate-800 bg-slate-900/60 flex items-center px-2 gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-1 rounded-md text-slate-300 hover:bg-slate-800 active:bg-slate-700 transition"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {condoLogo ? (
              <img src={condoLogo} alt="" className="w-7 h-7 object-contain rounded shrink-0" />
            ) : (
              <Logo size={28} />
            )}
            <div className="text-sm font-bold text-slate-100 truncate">
              {condoNome ?? 'OnWay'}
            </div>
          </div>
          <NotificationBell />
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

        {/* Header desktop (sino à direita) */}
        <header className="hidden md:flex h-12 shrink-0 border-b border-slate-800 bg-slate-900/30 items-center justify-end px-4 gap-1">
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function ProfileAvatar({
  perfil,
  email,
}: {
  perfil: { avatar_url: string | null; nome_exibicao: string | null }
  email: string | null
}) {
  const ini = (perfil.nome_exibicao ?? email ?? '?').slice(0, 1).toUpperCase()
  if (perfil.avatar_url) {
    return (
      <img
        src={perfil.avatar_url}
        alt=""
        className="w-8 h-8 rounded-full object-cover bg-brand-50 dark:bg-brand-700/20 shrink-0"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/30 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
      {ini}
    </div>
  )
}
