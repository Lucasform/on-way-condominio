import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  detectTenantSlug,
  hexToRgbTriplet,
  loadTenantBrand,
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
  const [brand, setBrand] = useState<TenantBrand | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)

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

  return <Ctx.Provider value={{ brand, loading, slug }}>{children}</Ctx.Provider>
}

function applyBrand(brand: TenantBrand | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Cor primaria via CSS var. Tailwind brand-600/700 podem ser sobrescritos
  // depois via tailwind config consumindo --brand-rgb se quisermos. Por ora
  // exposto como --brand-rgb pra usar em inline styles em CTAs principais.
  if (brand?.cor_primaria) {
    const triplet = hexToRgbTriplet(brand.cor_primaria)
    if (triplet) {
      root.style.setProperty('--brand-rgb', triplet)
    }
  } else {
    root.style.removeProperty('--brand-rgb')
  }

  // Titulo da aba
  if (brand?.nome) {
    document.title = `${brand.nome} · OnWay`
  }
}
