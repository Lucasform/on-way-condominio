import { Link } from 'react-router-dom'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import { useAuth } from './AuthProvider'

/**
 * Faixa amarela no topo do app durante o período de trial.
 * Mostra dias restantes e CTA para escolher plano.
 * Some automaticamente quando não é trial ou para admin_onway.
 */
export default function TrialBanner() {
  const { assinatura } = useFeatureFlags()
  const { perfil } = useAuth()

  if (!assinatura) return null
  if (assinatura.status !== 'trial') return null
  if (perfil?.role === 'admin_onway') return null
  if (!assinatura.trial_ends_at) return null

  const trialEnd = new Date(assinatura.trial_ends_at)
  const now = new Date()
  const diffMs = trialEnd.getTime() - now.getTime()
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diasRestantes <= 0) return null

  const isUrgente = diasRestantes <= 3

  return (
    <div className={`w-full px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium ${
      isUrgente
        ? 'bg-red-500/90 text-white'
        : 'bg-amber-500/20 text-amber-300 border-b border-amber-500/20'
    }`}>
      <span>
        {isUrgente
          ? `⚠️ Seu trial expira em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}. Escolha um plano para não perder o acesso.`
          : `🎁 ${diasRestantes} dias restantes no trial completo. Explore tudo sem restrições.`
        }
      </span>
      <Link
        to="/planos"
        className={`shrink-0 px-3 py-1 rounded-md font-semibold transition ${
          isUrgente
            ? 'bg-white text-red-600 hover:bg-red-50'
            : 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-200'
        }`}
      >
        Ver planos
      </Link>
    </div>
  )
}
