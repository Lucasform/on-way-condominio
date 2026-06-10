import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'
import { signOut } from '../lib/auth'
import AppLauncher from '../components/AppLauncher'
import CondominioSwitcher from '../components/CondominioSwitcher'

/**
 * Hub do mobile: launcher de apps (grade de ícones) + conta (perfil, troca de
 * condomínio, tema, sair). No desktop a sidebar cobre tudo isso.
 */
export default function Mais() {
  const { effectiveRole, perfil, user } = useAuth()
  const navigate = useNavigate()
  if (!effectiveRole) return null

  const ini = (perfil?.nome_exibicao ?? user?.email ?? '?').slice(0, 1).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  return (
    <div className="px-4 py-6 pb-24 max-w-3xl mx-auto">
      {/* Cartão de conta */}
      <Link
        to="/meu-perfil"
        className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 mb-5 hover:border-slate-700 transition"
      >
        {perfil?.avatar_url ? (
          <img src={perfil.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-700/30 text-brand-300 text-lg font-bold flex items-center justify-center shrink-0">
            {ini}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-100 truncate">
            {perfil?.nome_exibicao ?? user?.email}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {roleLabel(effectiveRole)}
          </div>
        </div>
        <span className="text-slate-500 text-sm shrink-0">✎</span>
      </Link>

      <CondominioSwitcher />

      {/* Launcher de apps */}
      <AppLauncher />

      {/* Conta */}
      <div className="mt-2 border-t border-slate-800 pt-5 flex justify-end">
        <button
          onClick={handleSignOut}
          className="px-4 py-2 rounded-lg text-sm font-medium text-red-300 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
