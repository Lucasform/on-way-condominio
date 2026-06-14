import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'
import { roleLabel } from '../lib/nav'
import { supabase } from '../lib/supabase'
import CondominioSwitcher from './CondominioSwitcher'

/**
 * Menu de conta no topo (substitui o rodapé da antiga sidebar): perfil, troca
 * de condomínio, "ver como morador", tema e sair. Dropdown com clique-fora.
 */
export default function AccountMenu() {
  const { perfil, user, effectiveRole, viewAsMorador, setViewAsMorador } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!perfil) return null
  const ini = (perfil.nome_exibicao ?? user?.email ?? '?').slice(0, 1).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-800/60 transition"
        aria-label="Conta"
        aria-expanded={open}
      >
        {perfil.avatar_url ? (
          <img src={perfil.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-brand-700/30 text-brand-300 text-sm font-bold flex items-center justify-center">
            {ini}
          </span>
        )}
        <span className="hidden sm:block text-xs text-slate-300 max-w-[140px] truncate">
          {perfil.nome_exibicao ?? user?.email}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" aria-hidden onClick={() => setOpen(false)} />
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl z-50 overflow-hidden">
          <Link
            to="/meu-perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 transition"
          >
            {perfil.avatar_url ? (
              <img src={perfil.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <span className="w-10 h-10 rounded-full bg-brand-700/30 text-brand-300 font-bold flex items-center justify-center">
                {ini}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100 truncate">{perfil.nome_exibicao ?? user?.email}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {viewAsMorador ? `${roleLabel('morador')} (visão)` : roleLabel(effectiveRole ?? perfil.role)}
              </div>
            </div>
          </Link>

          <div className="px-2 py-2 border-b border-slate-800">
            <CondominioSwitcher />
          </div>

          {podeAlternarMorador && (
            <button
              onClick={() => { setViewAsMorador(!viewAsMorador); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm border-b border-slate-800 transition ${
                viewAsMorador
                  ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {viewAsMorador ? '👁 Voltar ao meu papel' : '👁 Ver como morador'}
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition"
          >
            Sair
          </button>
        </div>
        </>
      )}
    </div>
  )
}
