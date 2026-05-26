import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel } from '../lib/nav'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

export default function AppShell() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const items = perfil ? menuFor(perfil.role) : []

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          <Logo size={36} />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">
              <span className="text-brand-700 dark:text-brand-400">OnWay</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Condomínio
            </div>
          </div>
        </div>

        {perfil && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
            {roleLabel(perfil.role)}
          </div>
        )}

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
