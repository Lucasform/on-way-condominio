import { useLocation } from 'react-router-dom'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import { ROUTE_FEATURE } from '../types/featureFlag'
import type { FeatureKey } from '../types/featureFlag'
import UpgradeGate from './UpgradeGate'

/**
 * Guardião global de features. Fica dentro do AppShell e substitui o
 * conteúdo da rota por UpgradeGate quando a feature não está disponível.
 * Retorna null (invisível) nas rotas que não exigem feature específica.
 */
export default function FeatureGuard({ children }: { children?: React.ReactNode }) {
  const { isActive, loading } = useFeatureFlags()
  const { pathname } = useLocation()

  if (loading) return <>{children}</>

  const base = '/' + pathname.split('/')[1]
  const feat: FeatureKey | undefined = ROUTE_FEATURE[base] as FeatureKey | undefined

  if (feat && !isActive(feat)) {
    return <UpgradeGate feature={feat} />
  }

  return <>{children}</>
}
