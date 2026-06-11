import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { menuFor, isGroup, iconFor, type MenuLeaf } from '../lib/nav'
import { useNavBadges } from '../hooks/useNavBadges'

interface AppLauncherProps {
  /** Classe extra no container (ex.: `md:hidden` pra só mobile). */
  className?: string
  /** Achata tudo num grid único, sem títulos de seção (usado em atalhos). */
  flat?: boolean
  /** Limita a quantidade de tiles (modo flat). */
  max?: number
}

/**
 * Launcher estilo home de celular: grade de ícones grandes e coloridos.
 * As funções vêm do menu do papel (mesma fonte da sidebar/bottom nav).
 */
export default function AppLauncher({ className = '', flat = false, max }: AppLauncherProps) {
  const { effectiveRole } = useAuth()
  if (!effectiveRole) return null
  const items = menuFor(effectiveRole)

  // Achata grupos em seções. Remove "Início" (/) — a home já é o launcher.
  const secoes: { titulo: string | null; leafs: MenuLeaf[] }[] = []
  const topo: MenuLeaf[] = []
  for (const item of items) {
    if (isGroup(item)) {
      const leafs = item.children.filter((c) => c.to !== '/')
      if (leafs.length) secoes.push({ titulo: item.label, leafs })
    } else if (item.to !== '/') {
      topo.push(item)
    }
  }
  if (topo.length) secoes.unshift({ titulo: null, leafs: topo })

  if (flat) {
    const todos = secoes.flatMap((s) => s.leafs)
    const leafs = max ? todos.slice(0, max) : todos
    return (
      <div className={className}>
        <Grade leafs={leafs} />
      </div>
    )
  }

  return (
    <div className={className}>
      {secoes.map((s, i) => (
        <div key={i} className="mb-7">
          {s.titulo && (
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-1">
              {s.titulo}
            </div>
          )}
          <Grade leafs={s.leafs} />
        </div>
      ))}
    </div>
  )
}

function Grade({ leafs }: { leafs: MenuLeaf[] }) {
  const badges = useNavBadges()
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-3 gap-y-5">
      {leafs.map((leaf) => {
        const n = badges[leaf.to] ?? 0
        return (
          <Link
            key={leaf.to}
            to={leaf.to}
            className="group flex flex-col items-center gap-1.5 text-center"
          >
            <span className="relative">
              <span
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
                  bg-slate-800/60 border border-slate-700/70 text-slate-200
                  transition-colors duration-150 group-hover:border-brand-500/60 group-hover:bg-slate-800"
              >
                {iconFor(leaf.to)}
              </span>
              {n > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {n > 9 ? '9+' : n}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-400 leading-tight line-clamp-2">{leaf.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
