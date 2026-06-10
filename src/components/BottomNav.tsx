import { NavLink } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { bottomNavFor, iconFor } from '../lib/nav'
import { useNavBadges } from '../hooks/useNavBadges'

/**
 * Barra de abas inferior (só mobile). Cara de app nativo.
 * Itens principais por papel + "Mais" (launcher).
 */
export default function BottomNav() {
  const { effectiveRole } = useAuth()
  const badges = useNavBadges()
  if (!effectiveRole) return null
  const items = bottomNavFor(effectiveRole)

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur flex">
      {items.map((item) => {
        const n = badges[item.to] ?? 0
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition ${
                isActive ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="relative text-lg leading-none">
              {iconFor(item.to)}
              {n > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {n > 9 ? '9+' : n}
                </span>
              )}
            </span>
            <span className="leading-none">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
