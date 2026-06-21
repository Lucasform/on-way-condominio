import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

const DISMISS_KEY = 'onway:mfa_nudge_dismissed'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

/**
 * Nudge não-bloqueante para admin_onway configurar autenticação em dois fatores.
 * Aparece no topo do app e pode ser dispensado por 7 dias.
 * Some automaticamente se o usuário já tiver MFA ativo.
 */
export default function MfaBanner() {
  const { perfil } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (perfil?.role !== 'admin_onway') return

    // Verifica se foi dispensado recentemente
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const dismissed = Number(raw)
        if (Date.now() - dismissed < DISMISS_TTL_MS) return
      }
    } catch { /* ignora */ }

    // Checa se já tem fator TOTP verificado
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const hasVerified = data?.totp?.some((f: { status: string }) => f.status === 'verified')
      if (!hasVerified) setShow(true)
    }).catch(() => { /* ignora */ })
  }, [perfil?.role])

  if (!show) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignora */ }
    setShow(false)
  }

  return (
    <div className="w-full px-4 py-2 flex items-center justify-between gap-4 bg-violet-500/10 border-b border-violet-500/20 text-xs text-violet-300">
      <span>
        🔐 Reforce a segurança da sua conta de administrador ativando a verificação em dois fatores.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/meu-perfil"
          className="px-3 py-1 rounded-md bg-violet-500/20 hover:bg-violet-500/40 text-violet-200 font-semibold transition"
        >
          Ativar agora
        </Link>
        <button onClick={dismiss} className="text-violet-500 hover:text-violet-300 transition" aria-label="Dispensar">
          ✕
        </button>
      </div>
    </div>
  )
}
