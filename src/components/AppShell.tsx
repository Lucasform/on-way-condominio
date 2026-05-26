import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel, isGroup } from '../lib/nav'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'
import CondominioSwitcher from './CondominioSwitcher'
import { prefetchRoutes } from '../lib/prefetchRoutes'

export default function AppShell() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const items = perfil ? menuFor(perfil.role) : []
  const [condoLogo, setCondoLogo] = useState<string | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)
  const [unidadesAtivas, setUnidadesAtivas] = useState<number | null>(null)

  // Quem cuida do condomínio enxerga o widget de unidades
  const canVerUnidades = !!perfil && ['admin_onway', 'administradora', 'sindico', 'portaria'].includes(perfil.role)

  useEffect(() => {
    prefetchRoutes()
  }, [])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoLogo(null); setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome, logo_url').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) { setCondoLogo(data.logo_url); setCondoNome(data.nome) } })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  useEffect(() => {
    if (!canVerUnidades) { setUnidadesAtivas(null); return }
    let mounted = true
    let q = supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('ativo', true)
    if (perfil?.condominio_id) q = q.eq('condominio_id', perfil.condominio_id)
    q.then(({ count }) => { if (mounted) setUnidadesAtivas(count ?? 0) })
    return () => { mounted = false }
  }, [canVerUnidades, perfil?.condominio_id])

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
    <div className="min-h-screen bg-brand-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          {condoLogo ? (
            <img src={condoLogo} alt={condoNome ?? ''} className="w-9 h-9 object-contain rounded" />
          ) : (
            <Logo size={36} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">
              {condoNome ? (
                <span className="text-slate-900 dark:text-slate-100">{condoNome}</span>
              ) : (
                <span className="text-brand-700 dark:text-brand-400">OnWay</span>
              )}
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
            <span className="text-[10px] text-slate-400 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition shrink-0">
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
                              ? 'bg-brand-100 dark:bg-brand-700/20 text-brand-700 dark:text-brand-300 font-medium'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
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
                      ? 'bg-brand-100 dark:bg-brand-700/20 text-brand-700 dark:text-brand-300 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {canVerUnidades && unidadesAtivas !== null && (
          <Link
            to="/unidades"
            className="mx-2 mb-2 mt-1 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-brand-700/10 hover:border-brand-500 dark:hover:border-brand-500/60 transition flex items-center gap-2 text-xs"
            title="Ver unidades"
          >
            <span className="text-base leading-none">🏠</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {unidadesAtivas} {unidadesAtivas === 1 ? 'unidade ativa' : 'unidades ativas'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500">
                clique pra abrir
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-600">→</span>
          </Link>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
          <div className="text-xs text-slate-500 truncate" title={user?.email ?? ''}>
            {user?.email}
          </div>
          <div className="flex gap-2">
            <Link
              to="/meu-perfil"
              className="flex-1 px-2 py-1.5 rounded text-xs text-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition"
            >
              Perfil
            </Link>
            <button
              onClick={handleSignOut}
              className="flex-1 px-2 py-1.5 rounded text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 font-medium transition"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
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
