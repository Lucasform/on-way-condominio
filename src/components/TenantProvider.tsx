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
  applyManifest(brand)
  applyThemeColor(brand?.cor_primaria ?? null)
  applyFavicon(brand?.logo_url ?? null)
}

let lastManifestUrl: string | null = null

function applyManifest(brand: TenantBrand | null) {
  if (typeof document === 'undefined') return
  if (!brand) {
    // volta pro manifest estatico se houver
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    if (link && lastManifestUrl) {
      link.href = '/manifest.webmanifest'
      try { URL.revokeObjectURL(lastManifestUrl) } catch {}
      lastManifestUrl = null
    }
    return
  }
  const manifest = {
    name: brand.nome,
    short_name: brand.nome.slice(0, 12),
    description: brand.mensagem_boas_vindas ?? `App do condomínio ${brand.nome}`,
    start_url: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
    display: 'standalone',
    background_color: brand.cor_primaria ?? '#0F172A',
    theme_color: brand.cor_primaria ?? '#1D4ED8',
    icons: brand.logo_url
      ? [
          { src: brand.logo_url, sizes: '192x192', type: 'image/png' },
          { src: brand.logo_url, sizes: '512x512', type: 'image/png' },
        ]
      : [],
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  const url = URL.createObjectURL(blob)
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = url
  if (lastManifestUrl) {
    try { URL.revokeObjectURL(lastManifestUrl) } catch {}
  }
  lastManifestUrl = url
}

function applyThemeColor(hex: string | null) {
  if (typeof document === 'undefined') return
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = hex ?? '#1D4ED8'
}

function applyFavicon(url: string | null) {
  if (typeof document === 'undefined' || !url) return
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}
