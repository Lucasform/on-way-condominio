import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { menuFor, roleLabel, isGroup, iconFor } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { countWaUnread } from '../lib/whatsappInbox'
import NotificationBell from './NotificationBell'
import Logo from './Logo'
import CondominioSwitcher from './CondominioSwitcher'
import AccountMenu from './AccountMenu'
import ThemeToggle from './ThemeToggle'
import { prefetchRoutes } from '../lib/prefetchRoutes'

/**
 * Layout: sidebar no desktop (padrão web), top bar + launcher no mobile.
 * Cores autoradas em dark; o tema claro vem da rampa invertida de slate.
 */
export default function AppShell() {
  const { perfil, user, effectiveRole, viewAsMorador, setViewAsMorador } = useAuth()
  const navigate = useNavigate()
  const items = effectiveRole ? menuFor(effectiveRole) : []

  const [temPessoaResidencial, setTemPessoaResidencial] = useState(false)
  useEffect(() => {
    if (!user || !perfil || perfil.role === 'morador') { setTemPessoaResidencial(false); return }
    supabase
      .from('pessoas')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .in('tipo_vinculo', ['titular', 'conjuge', 'filho', 'dependente', 'inquilino', 'morador'])
      .then(({ count }) => setTemPessoaResidencial((count ?? 0) > 0))
  }, [user, perfil])
  const podeAlternarMorador = !!perfil && perfil.role !== 'morador' && temPessoaResidencial

  const [unidadeLabel, setUnidadeLabel] = useState<string | null>(null)
  useEffect(() => {
    if (!user) { setUnidadeLabel(null); return }
    supabase
      .from('pessoas')
      .select('unidades:unidade_id(bloco, numero)')
      .eq('user_id', user.id)
      .not('unidade_id', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const u = (data as { unidades?: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null } | null)?.unidades
        const uf = Array.isArray(u) ? u[0] : u
        setUnidadeLabel(uf ? (uf.bloco ? `${uf.bloco}-${uf.numero}` : uf.numero) : null)
      })
  }, [user])

  const [waUnread, setWaUnread] = useState(0)
  useEffect(() => {
    const condoId = perfil?.condominio_id
    const staff = perfil && ['administradora', 'sindico', 'subsindico'].includes(perfil.role)
    if (!condoId || !staff) { setWaUnread(0); return }
    let alive = true
    const load = () => countWaUnread(condoId).then((n) => { if (alive) setWaUnread(n) }).catch(() => {})
    load()
    const t = window.setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [perfil])

  const [condoLogo, setCondoLogo] = useState<string | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)

  useEffect(() => { prefetchRoutes() }, [])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoLogo(null); setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome, logo_url').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) { setCondoLogo(data.logo_url); setCondoNome(data.nome) } })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  async function handleSignOut() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  async function handleExitViewAs() {
    await supabase.rpc('exit_view_as')
    window.location.href = '/'
  }

  const emViewAs = perfil?.role === 'admin_onway' && perfil.condominio_id

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg text-sm transition ${
      isActive
        ? 'bg-brand-500/15 text-slate-100 font-semibold'
        : 'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100'
    }`

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex transition-colors">
      {/* Sidebar — só desktop. No mobile a navegação é o launcher de ícones. */}
      <aside
        className="hidden md:flex w-64 shrink-0 border-r border-slate-800 bg-slate-900/40 flex-col"
        aria-label="Navegação principal"
      >
        <Link to="/" className="px-4 py-4 border-b border-slate-800 flex items-center gap-2.5">
          {condoLogo ? (
            <img src={condoLogo} alt={condoNome ?? ''} className="w-9 h-9 object-contain rounded" />
          ) : (
            <Logo size={36} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate text-slate-100">
              {condoNome ?? 'OnWay'}
            </div>
            {!condoNome && (
              <div className="text-[10px] text-slate-400 leading-tight">Condomínio</div>
            )}
          </div>
        </Link>

        {perfil && (
          <Link
            to="/meu-perfil"
            title="Editar meu perfil"
            className="px-3 py-2 border-b border-slate-800 flex items-center gap-2.5 hover:bg-slate-800/40 transition group"
          >
            <ProfileAvatar perfil={perfil} email={user?.email ?? null} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-100 truncate">
                {perfil.nome_exibicao ?? user?.email ?? 'Sem nome'}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                {viewAsMorador ? `${roleLabel('morador')} (visão)` : roleLabel(perfil.role)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition shrink-0">✎</span>
          </Link>
        )}

        {podeAlternarMorador && (
          <button
            type="button"
            onClick={() => setViewAsMorador(!viewAsMorador)}
            className={`px-3 py-2 text-xs border-b border-slate-800 text-left transition ${
              viewAsMorador
                ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                : 'text-slate-400 hover:bg-slate-800/40'
            }`}
            title={viewAsMorador ? 'Voltar ao papel original' : 'Ver o app como um morador veria'}
          >
            {viewAsMorador ? '👁 Voltar ao papel' : '👁 Ver como morador'}
          </button>
        )}

        <CondominioSwitcher />

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((item, idx) => {
            if (isGroup(item)) {
              return (
                <div key={`g-${idx}-${item.label}`} className="pt-3 pb-1">
                  <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    {item.label}
                  </div>
                  <div className="space-y-1">
                    {item.children.map((child) => (
                      <NavLink key={child.to} to={child.to} className={navLinkCls}>
                        <span className="flex items-center gap-2.5">
                          <span className="text-base leading-none w-5 text-center shrink-0">{iconFor(child.to)}</span>
                          <span className="flex-1 truncate">{child.label}</span>
                          {child.to === '/whatsapp' && waUnread > 0 && (
                            <span className="shrink-0 text-[10px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5">{waUnread}</span>
                          )}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkCls}>
                <span className="flex items-center gap-2.5">
                  <span className="text-base leading-none w-5 text-center shrink-0">{iconFor(item.to)}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                </span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-3 flex items-center justify-between gap-2">
          <button
            onClick={handleSignOut}
            title={user?.email ?? 'Sair'}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition"
          >
            <SignOutIcon />
            <span>Sair</span>
          </button>
          <ThemeToggle compact />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-12 shrink-0 border-b border-slate-800 bg-slate-900/60 md:bg-slate-900/30 backdrop-blur flex items-center px-3 md:px-4 gap-2">
          <Link to="/" className="md:hidden flex items-center gap-2 min-w-0 flex-1">
            {condoLogo ? (
              <img src={condoLogo} alt="" className="w-7 h-7 object-contain rounded shrink-0" />
            ) : (
              <Logo size={28} />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate leading-tight">
                {condoNome ?? 'OnWay'}
              </div>
              {unidadeLabel && (
                <div className="text-[10px] text-slate-400 leading-tight">Un. {unidadeLabel}</div>
              )}
            </div>
          </Link>
          <div className="hidden md:block flex-1" />
          <NotificationBell />
          <div className="md:hidden">
            <AccountMenu />
          </div>
        </header>

        {emViewAs && (
          <div className="shrink-0 bg-amber-400 border-b border-amber-500 px-4 py-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-zinc-900 font-medium">
              👁 Você está em modo "Ver como". Assumiu o condomínio <strong>{condoNome ?? '...'}</strong> como Administrador OnWay.
            </span>
            <button
              onClick={handleExitViewAs}
              className="px-3 py-1 rounded bg-zinc-900/15 hover:bg-zinc-900/25 text-zinc-900 font-semibold whitespace-nowrap"
            >
              ← Voltar pra visão global
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function ProfileAvatar({ perfil, email }: { perfil: { avatar_url: string | null; nome_exibicao: string | null }; email: string | null }) {
  const ini = (perfil.nome_exibicao ?? email ?? '?').slice(0, 1).toUpperCase()
  if (perfil.avatar_url) {
    return <img src={perfil.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover bg-brand-700/20 shrink-0" />
  }
  return (
    <div className="w-8 h-8 rounded-full bg-brand-700/30 text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
      {ini}
    </div>
  )
}
