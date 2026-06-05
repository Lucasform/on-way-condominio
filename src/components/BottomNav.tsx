import { NavLink } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { bottomNavFor, iconFor } from '../lib/nav'

/**
 * Barra de abas inferior (só mobile). Cara de app nativo.
 * Itens principais por papel + "Mais" (launcher).
 */
export default function BottomNav() {
  const { effectiveRole } = useAuth()
  if (!effectiveRole) return null
  const items = bottomNavFor(effectiveRole)

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur flex">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition ${
              isActive ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <span className="text-lg leading-none">{iconFor(item.to)}</span>
          <span className="leading-none">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
