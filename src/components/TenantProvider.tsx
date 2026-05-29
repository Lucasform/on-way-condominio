import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import {
  detectTenantSlug,
  gerarPaletaBrand,
  loadTenantBrand,
  loadTenantBrandById,
  type TenantBrand,
} from '../lib/tenant'

interface TenantCtx {
  brand: TenantBrand | null
  loading: boolean
  slug: string | null
}

const Ctx = createContext<TenantCtx>({ brand: null, loading: false, slug: null })

export function useTenant(): TenantCtx {
  return useContext(Ctx)
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth()
  const [brand, setBrand] = useState<TenantBrand | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)

  // 1) Detecta slug pela URL (subdominio ou path) e carrega brand pre-login.
  useEffect(() => {
    const detected = detectTenantSlug()
    setSlug(detected)
    if (!detected) {
      setLoading(false)
      return
    }
    let mounted = true
    loadTenantBrand(detected)
      .then((b) => {
        if (!mounted) return
        setBrand(b)
        applyBrand(b)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // 2) Quando o user loga, se tem condominio_id e ainda nao temos brand
  //    pelo slug da URL, busca por id pra aplicar o tema do condo dele.
  //    Admin OnWay (sem condominio_id) cai no tema default.
  useEffect(() => {
    if (brand) return
    const condoId = perfil?.condominio_id
    if (!condoId) return
    let mounted = true
    loadTenantBrandById(condoId)
      .then((b) => {
        if (!mounted) return
        setBrand(b)
        applyBrand(b)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [perfil?.condominio_id, brand])

  return <Ctx.Provider value={{ brand, loading, slug }}>{children}</Ctx.Provider>
}

const PALETA_TOMS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

export function applyBrandColor(corHex: string | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const paleta = gerarPaletaBrand(corHex)
  if (!paleta) {
    for (const tom of PALETA_TOMS) root.style.removeProperty(`--brand-${tom}`)
    root.style.removeProperty('--brand-rgb')
    return
  }
  for (const tom of PALETA_TOMS) {
    root.style.setProperty(`--brand-${tom}`, paleta[tom])
  }
  // Compatibilidade com qualquer uso direto de --brand-rgb
  root.style.setProperty('--brand-rgb', paleta[700])
}

function applyBrand(brand: TenantBrand | null) {
  if (typeof document === 'undefined') return
  applyBrandColor(brand?.cor_primaria ?? null)
  if (brand?.nome) {
    document.title = `${brand.nome} · OnWay`
  }
}
