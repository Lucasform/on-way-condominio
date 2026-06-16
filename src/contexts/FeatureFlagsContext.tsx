import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { listFeatureFlags, updateFeatureFlag } from '../lib/featureFlags'
import type { FeatureFlag, FeatureKey } from '../types/featureFlag'
import { ROUTE_FEATURE } from '../types/featureFlag'
import { useAuth } from '../components/AuthProvider'

interface FeatureFlagsCtx {
  flags: FeatureFlag[]
  isActive: (key: FeatureKey) => boolean
  routeVisible: (to: string) => boolean
  toggle: (key: FeatureKey, ativo: boolean) => Promise<void>
  loading: boolean
}

const Ctx = createContext<FeatureFlagsCtx>({
  flags: [],
  isActive: () => true,
  routeVisible: () => true,
  toggle: async () => {},
  loading: true,
})

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    listFeatureFlags()
      .then((data) => setFlags(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  function isActive(key: FeatureKey): boolean {
    if (loading || flags.length === 0) return true
    const flag = flags.find((f) => f.key === key)
    return flag ? flag.ativo : true
  }

  function routeVisible(to: string): boolean {
    const feat = ROUTE_FEATURE[to]
    return !feat || isActive(feat)
  }

  async function toggle(key: FeatureKey, ativo: boolean) {
    await updateFeatureFlag(key, ativo)
    setFlags((prev) => prev.map((f) => f.key === key ? { ...f, ativo } : f))
  }

  return (
    <Ctx.Provider value={{ flags, isActive, routeVisible, toggle, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFeatureFlags() {
  return useContext(Ctx)
}

export function useFeature(key: FeatureKey): boolean {
  return useContext(Ctx).isActive(key)
}
