import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { listFeatureFlags, updateFeatureFlag } from '../lib/featureFlags'
import { getAssinatura, resolverFeaturesDisponiveis } from '../lib/billing'
import type { FeatureFlag, FeatureKey } from '../types/featureFlag'
import { ROUTE_FEATURE } from '../types/featureFlag'
import type { Assinatura } from '../types/billing'
import { useAuth } from '../components/AuthProvider'

interface FeatureFlagsCtx {
  flags: FeatureFlag[]
  assinatura: Assinatura | null
  isActive: (key: FeatureKey) => boolean
  routeVisible: (to: string) => boolean
  toggle: (key: FeatureKey, ativo: boolean) => Promise<void>
  loading: boolean
}

const Ctx = createContext<FeatureFlagsCtx>({
  flags: [],
  assinatura: null,
  isActive: () => true,
  routeVisible: () => true,
  toggle: async () => {},
  loading: true,
})

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user, perfil } = useAuth()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const condoId = perfil?.condominio_id ?? null
    const isAdminOnway = perfil?.role === 'admin_onway'

    Promise.all([
      listFeatureFlags(),
      condoId && !isAdminOnway ? getAssinatura(condoId) : Promise.resolve(null),
    ])
      .then(([f, a]) => {
        setFlags(f)
        setAssinatura(a)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, perfil?.condominio_id, perfil?.role])

  function isActive(key: FeatureKey): boolean {
    if (loading) return true
    const isAdminOnway = perfil?.role === 'admin_onway'

    // 1. Feature precisa estar globalmente habilitada no produto
    const flagGlobal = flags.find((f) => f.key === key)
    if (flagGlobal && !flagGlobal.ativo) return false

    // 2. admin_onway sem condo → acesso irrestrito ao painel
    if (isAdminOnway) return true

    // 3. Entitlement por condo (trial → tudo; ativo → só o plano + extras)
    const featuresGlobais = flags.filter((f) => f.ativo).map((f) => f.key)
    const disponiveis = resolverFeaturesDisponiveis(assinatura, featuresGlobais)
    return disponiveis.has(key)
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
    <Ctx.Provider value={{ flags, assinatura, isActive, routeVisible, toggle, loading }}>
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
