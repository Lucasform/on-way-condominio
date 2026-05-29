import { supabase } from './supabase'

export interface TenantBrand {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  cor_primaria: string | null
  texto_login: string | null
  imagem_login_url: string | null
  permite_signup: boolean
  mensagem_boas_vindas: string | null
}

const CACHE_KEY = 'onway:tenant_brand'
const CACHE_TTL_MS = 5 * 60_000

interface CacheEntry {
  slug: string
  brand: TenantBrand | null
  ts: number
}

// Hostnames "neutros" da plataforma (sem condominio especifico)
// Subdominios diferentes desses sao considerados tenants.
const NEUTRAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'on-way-condominio.vercel.app',
  'onwaytech.com.br',
  'www.onwaytech.com.br',
  'app.onwaytech.com.br',
])

/**
 * Detecta slug do condominio pela URL atual:
 *   1. subdominio (jardim-paulista.onwaytech.com.br) → 'jardim-paulista'
 *   2. path prefix (/c/jardim-paulista/...) → 'jardim-paulista'
 *   3. retorna null se for host neutro ou nenhum match
 */
export function detectTenantSlug(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname.toLowerCase()
  const path = window.location.pathname

  // Path prefix /c/<slug>/...
  const pathMatch = path.match(/^\/c\/([a-z0-9][a-z0-9-]{0,62})(\/|$)/i)
  if (pathMatch) return pathMatch[1].toLowerCase()

  // Subdominio: separa antes do dominio raiz
  if (NEUTRAL_HOSTS.has(host)) return null
  // Suporta dominio.com.br (3 partes) ou dominio.com (2 partes)
  const parts = host.split('.')
  // Precisa de >= 3 partes pra ser subdominio (sub.dominio.com)
  if (parts.length < 3) return null
  const sub = parts[0]
  if (sub === 'www' || sub === 'app') return null
  // Slug valido: kebab-case, letras/numeros/hifen
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(sub)) return null
  return sub
}

/**
 * Resolve brand pelo slug. Cacheia em localStorage por 5min pra evitar
 * fetch repetido em cada navegacao SPA.
 */
export async function loadTenantBrand(slug: string): Promise<TenantBrand | null> {
  // Cache hit?
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry
      if (entry.slug === slug && Date.now() - entry.ts < CACHE_TTL_MS) {
        return entry.brand
      }
    }
  } catch {
    // ignora cache invalido
  }

  let brand: TenantBrand | null = null
  try {
    const { data, error } = await supabase.rpc('condominio_brand_by_slug', { p_slug: slug })
    if (!error && Array.isArray(data) && data.length > 0) {
      brand = data[0] as TenantBrand
    }
  } catch (e) {
    console.warn('[tenant] brand lookup falhou:', e)
  }

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ slug, brand, ts: Date.now() } as CacheEntry),
    )
  } catch {
    // localStorage pode estar cheio ou desabilitado
  }
  return brand
}

export function clearTenantCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignora
  }
}

/**
 * Converte hex (#1D4ED8) em "29 78 216" pra usar em rgb() do Tailwind via CSS var.
 * Aceita 3 ou 6 chars (com ou sem #). Retorna null em formato invalido.
 */
export function hexToRgbTriplet(hex: string | null): string | null {
  if (!hex) return null
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}
