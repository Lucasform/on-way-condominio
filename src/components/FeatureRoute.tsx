import { Navigate } from 'react-router-dom'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import type { FeatureKey } from '../types/featureFlag'
import type { ReactNode } from 'react'

interface Props {
  feature: FeatureKey
  children: ReactNode
}

export default function FeatureRoute({ feature, children }: Props) {
  const { isActive, loading } = useFeatureFlags()
  if (loading) return null
  if (!isActive(feature)) return <Navigate to="/" replace />
  return <>{children}</>
}
