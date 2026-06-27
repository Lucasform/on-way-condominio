import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { listFeatureFlags, updateFeatureFlag } from '../lib/featureFlags'
import { getAssinatura, resolverFeaturesDisponiveis } from '../lib/billing'
import { getLaunchMode, setLaunchMode } from '../lib/plataformaConfig'
import type { FeatureFlag, FeatureKey } from '../types/featureFlag'
import { ROUTE_FEATURE } from '../types/featureFlag'
import type { Assinatura } from '../types/billing'
import { useAuth } from '../components/AuthProvider'

interface FeatureFlagsCtx {
  flags: FeatureFlag[]
  assinatura: Assinatura | null
  launchMode: boolean
  isActive: (key: FeatureKey) => boolean
  routeVisible: (to: string) => boolean
  toggle: (key: FeatureKey, ativo: boolean) => Promise<void>
  toggleLaunchMode: (ativo: boolean) => Promise<void>
  loading: boolean
}

const Ctx = createContext<FeatureFlagsCtx>({
  flags: [],
  assinatura: null,
  launchMode: true,
  isActive: () => true,
  routeVisible: () => true,
  toggle: async () => {},
  toggleLaunchMode: async () => {},
  loading: true,
})

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user, perfil } = useAuth()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [launchMode, setLaunchMode_] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const condoId = perfil?.condominio_id ?? null
    const isAdminOnway = perfil?.role === 'admin_onway' || perfil?.role === 'admin'

    Promise.all([
      listFeatureFlags(),
      condoId && !isAdminOnway ? getAssinatura(condoId) : Promise.resolve(null),
      getLaunchMode(),
    ])
      .then(([f, a, lm]) => {
        setFlags(f)
        setAssinatura(a)
        setLaunchMode_(lm)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, perfil?.condominio_id, perfil?.role])

  function isActive(key: FeatureKey): boolean {
    if (loading) return true

    // 1. Feature precisa estar globalmente habilitada no produto
    const flagGlobal = flags.find((f) => f.key === key)
    if (flagGlobal && !flagGlobal.ativo) return false

    const isAdminOnway = perfil?.role === 'admin_onway' || perfil?.role === 'admin'

    // 2. admin_onway → acesso irrestrito
    if (isAdminOnway) return true

    // 3. Modo lançamento → tudo liberado para todos
    if (launchMode) return true

    // 4. Entitlement por assinatura
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

  async function toggleLaunchMode(ativo: boolean) {
    await setLaunchMode(ativo)
    setLaunchMode_(ativo)
  }

  return (
    <Ctx.Provider value={{ flags, assinatura, launchMode, isActive, routeVisible, toggle, toggleLaunchMode, loading }}>
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
