import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

type MfaState = 'loading' | 'required' | 'ok'

/**
 * Gate obrigatório de MFA para admin_onway.
 * Bloqueia o app inteiro até que o admin configure e verifique um fator TOTP.
 * Para outros roles: transparente (não renderiza nada extra).
 */
export default function MfaBanner() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<MfaState>('loading')

  useEffect(() => {
    if (perfil?.role !== 'admin_onway') {
      setState('ok')
      return
    }

    supabase.auth.mfa.listFactors().then(({ data }) => {
      const hasVerified = data?.totp?.some((f) => f.status === 'verified')
      setState(hasVerified ? 'ok' : 'required')
    }).catch(() => setState('ok')) // em caso de erro na API, não bloqueia
  }, [perfil?.role])

  // Revalida quando a janela volta ao foco (usuário pode ter configurado em outra aba)
  useEffect(() => {
    if (perfil?.role !== 'admin_onway') return
    const recheck = () => {
      supabase.auth.mfa.listFactors().then(({ data }) => {
        const hasVerified = data?.totp?.some((f) => f.status === 'verified')
        if (hasVerified) setState('ok')
      }).catch(() => {})
    }
    window.addEventListener('focus', recheck)
    return () => window.removeEventListener('focus', recheck)
  }, [perfil?.role])

  if (perfil?.role !== 'admin_onway') return null
  if (state !== 'required') return null

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl">🔐</div>

        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">
            Autenticação em dois fatores obrigatória
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Para acessar o painel de Administrador OnWay é necessário configurar
            a verificação em dois fatores. Isso protege todos os condomínios gerenciados
            por esta conta.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left space-y-3">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Como configurar</p>
          <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
            <li>Instale um app autenticador (Google Authenticator, Authy, 1Password)</li>
            <li>Acesse <strong className="text-slate-100">Meu Perfil → Segurança</strong></li>
            <li>Escaneie o QR code e confirme o código</li>
          </ol>
        </div>

        <button
          onClick={() => navigate('/meu-perfil')}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition"
        >
          Ir para Meu Perfil →
        </button>

        <p className="text-xs text-slate-600">
          Após configurar o 2FA, volte a esta janela. O acesso será liberado automaticamente.
        </p>
      </div>
    </div>
  )
}
