import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { menuFor, isGroup, iconFor, roleLabel, type MenuLeaf } from '../lib/nav'

/**
 * Launcher estilo "apps" do celular: todas as funções do papel em grade de
 * ícones. Aparece no mobile via bottom nav. No desktop a sidebar já cobre.
 */
export default function Mais() {
  const { effectiveRole, perfil, user } = useAuth()
  if (!effectiveRole) return null
  const items = menuFor(effectiveRole)

  // achata grupos em seções pra renderizar como blocos
  const secoes: { titulo: string | null; leafs: MenuLeaf[] }[] = []
  const topo: MenuLeaf[] = []
  for (const item of items) {
    if (isGroup(item)) secoes.push({ titulo: item.label, leafs: item.children })
    else topo.push(item)
  }
  if (topo.length) secoes.unshift({ titulo: null, leafs: topo })

  return (
    <div className="px-4 py-6 pb-24 max-w-3xl mx-auto">
      <div className="mb-5">
        <div className="text-lg font-semibold text-slate-100">Tudo</div>
        <div className="text-xs text-slate-500">
          {perfil?.nome_exibicao ?? user?.email} · {roleLabel(effectiveRole)}
        </div>
      </div>

      {secoes.map((s, i) => (
        <div key={i} className="mb-6">
          {s.titulo && (
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2 px-1">
              {s.titulo}
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {s.leafs.map((leaf) => (
              <Link
                key={leaf.to}
                to={leaf.to}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition aspect-square text-center"
              >
                <span className="text-2xl leading-none">{iconFor(leaf.to)}</span>
                <span className="text-[11px] text-slate-300 leading-tight">{leaf.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
