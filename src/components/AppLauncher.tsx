import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { menuFor, isGroup, navLabel, type MenuLeaf } from '../lib/nav'
import { navIcon } from '../lib/navIcons'
import { useNavBadges } from '../hooks/useNavBadges'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'

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
  const { effectiveRole, perfil } = useAuth()
  const { routeVisible } = useFeatureFlags()
  if (!effectiveRole) return null
  const items = menuFor(effectiveRole)
  const emCondo = !!perfil?.condominio_id

  // Achata grupos em seções. Remove "Início" (/) — a home já é o launcher.
  const secoes: { titulo: string | null; leafs: MenuLeaf[] }[] = []
  const topo: MenuLeaf[] = []
  for (const item of items) {
    if (isGroup(item)) {
      const leafs = item.children.filter((c) => c.to !== '/' && routeVisible(c.to))
      if (leafs.length) secoes.push({ titulo: item.label, leafs })
    } else if (item.to !== '/' && routeVisible(item.to)) {
      topo.push(item)
    }
  }
  if (topo.length) secoes.unshift({ titulo: null, leafs: topo })

  if (flat) {
    const todos = secoes.flatMap((s) => s.leafs)
    const leafs = max ? todos.slice(0, max) : todos
    return (
      <div className={className}>
        <Grade leafs={leafs} emCondo={emCondo} />
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
          <Grade leafs={s.leafs} emCondo={emCondo} />
        </div>
      ))}
    </div>
  )
}

function Grade({ leafs, emCondo }: { leafs: MenuLeaf[]; emCondo: boolean }) {
  const badges = useNavBadges()
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-3 gap-y-5">
      {leafs.map((leaf) => {
        const n = badges[leaf.to] ?? 0
        const Icon = navIcon(leaf.to)
        return (
          <Link
            key={leaf.to}
            to={leaf.to}
            className="group flex flex-col items-center gap-1.5 text-center"
          >
            <span className="relative">
              <span
                className="w-16 h-16 rounded-2xl flex items-center justify-center
                  bg-brand-500/10 text-brand-600 dark:text-brand-300 shadow-sm
                  transition-colors duration-150 group-hover:bg-brand-500/20"
              >
                <Icon className="w-7 h-7" />
              </span>
              {n > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {n > 9 ? '9+' : n}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-400 leading-tight line-clamp-2">{navLabel(leaf.to, leaf.label, emCondo)}</span>
          </Link>
        )
      })}
    </div>
  )
}
