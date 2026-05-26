import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel } from '../lib/nav'
import NotificationBell from './NotificationBell'

export default function AppShell() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const items = perfil ? menuFor(perfil.role) : []

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-lg font-semibold bg-gradient-to-r from-emerald-400 to-sky-500 bg-clip-text text-transparent">
            OnWay Condomínio
          </div>
          {perfil && (
            <div className="mt-1 text-xs text-slate-400">{roleLabel(perfil.role)}</div>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-3 space-y-2">
          <div className="text-xs text-slate-500 truncate" title={user?.email ?? ''}>
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left text-sm text-slate-400 hover:text-red-300 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 border-b border-slate-800 bg-slate-900/30 flex items-center justify-end px-4 gap-2">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
