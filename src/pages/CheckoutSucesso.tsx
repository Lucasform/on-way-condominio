import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'

export default function CheckoutSucesso() {
  const { perfil } = useAuth()
  const [ativo, setAtivo] = useState(false)

  useEffect(() => {
    if (!perfil?.condominio_id) return

    // Polling leve: confere a cada 2s até o webhook atualizar o status
    let tentativas = 0
    const id = setInterval(async () => {
      tentativas++
      const { data } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('condominio_id', perfil.condominio_id)
        .maybeSingle()

      if (data?.status === 'ativo') {
        setAtivo(true)
        clearInterval(id)
      }
      if (tentativas >= 15) clearInterval(id) // para após 30s
    }, 2000)

    return () => clearInterval(id)
  }, [perfil?.condominio_id])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {ativo ? (
          <>
            <div className="text-5xl mb-6">🎉</div>
            <h1 className="text-2xl font-bold text-slate-100 mb-3">Plano ativado!</h1>
            <p className="text-slate-400 mb-8">
              Sua assinatura está ativa. Todas as funcionalidades do plano já estão disponíveis.
            </p>
            <Link
              to="/"
              className="inline-block px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition"
            >
              Acessar o app →
            </Link>
          </>
        ) : (
          <>
            <div className="text-5xl mb-6 animate-pulse">⏳</div>
            <h1 className="text-2xl font-bold text-slate-100 mb-3">Confirmando pagamento...</h1>
            <p className="text-slate-400 mb-8">
              Estamos aguardando a confirmação do Stripe. Isso leva alguns segundos.
            </p>
            <Link to="/planos" className="text-sm text-brand-400 hover:underline">
              Ir para Planos
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
