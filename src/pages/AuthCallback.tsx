import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthShell from '../components/AuthShell'

/**
 * Página de callback do Supabase Auth — recebe o redirect depois de:
 *  - Magic link (sign-in via OTP por e-mail)
 *  - Confirmação de e-mail (signup)
 *  - OAuth provider (Google)
 *  - Reset password
 *
 * O Supabase JS lida com o token na URL automaticamente; aqui só
 * esperamos a sessão estar pronta e redirecionamos pra rota certa.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Se há "type=recovery" na hash/query, é reset de senha → vai pra atualizar
    const hash = window.location.hash || ''
    const query = window.location.search || ''
    const isRecovery = hash.includes('type=recovery') || query.includes('type=recovery')

    let cancel = false

    async function go() {
      // Espera o supabase processar a URL (~100ms-1s)
      await new Promise((r) => setTimeout(r, 300))
      const { data, error } = await supabase.auth.getSession()
      if (cancel) return

      if (error) {
        setError(error.message)
        return
      }
      if (!data.session) {
        setError('Sessão não estabelecida. O link pode ter expirado.')
        return
      }

      if (isRecovery) {
        navigate('/atualizar-senha', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
    go()

    return () => {
      cancel = true
    }
  }, [navigate])

  if (error) {
    return (
      <AuthShell title="Algo deu errado">
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm"
        >
          Voltar pro login
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Entrando..." subtitle="Verificando sua autenticação">
      <div className="text-center text-slate-400 py-8">
        <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AuthShell>
  )
}
