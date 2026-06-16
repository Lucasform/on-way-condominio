import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import { ROUTE_FEATURE } from '../types/featureFlag'

/**
 * Guardião global de features. Fica dentro do AppShell e redireciona
 * para / quando o usuário tenta acessar uma rota com feature desativada.
 * Não precisa envolver cada rota individualmente.
 */
export default function FeatureGuard() {
  const { isActive, loading } = useFeatureFlags()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    // Verifica rota exata e prefixos (ex: /classificados/uuid → classificados)
    const base = '/' + pathname.split('/')[1]
    const feat = ROUTE_FEATURE[base]
    if (feat && !isActive(feat)) {
      navigate('/', { replace: true })
    }
  }, [pathname, loading, isActive, navigate])

  return null
}
