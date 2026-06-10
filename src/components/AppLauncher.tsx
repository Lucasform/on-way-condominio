import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { menuFor, isGroup, iconFor, iconColorFor, type MenuLeaf } from '../lib/nav'
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

  // Achata grupos em seções
  const secoes: { titulo: string | null; leafs: MenuLeaf[] }[] = []
  const topo: MenuLeaf[] = []
  for (const item of items) {
    if (isGroup(item)) secoes.push({ titulo: item.label, leafs: item.children })
    else topo.push(item)
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
                className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-3xl text-white
                  shadow-lg shadow-black/20 ring-1 ring-white/10 transition-transform duration-150
                  group-hover:scale-105 group-active:scale-95 ${iconColorFor(leaf.to)}`}
              >
                {iconFor(leaf.to)}
              </span>
              {n > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {n > 9 ? '9+' : n}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-300 leading-tight line-clamp-2">{leaf.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
