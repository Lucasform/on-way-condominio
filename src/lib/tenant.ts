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
  'onwaycondominio.com',
  'www.onwaycondominio.com',
  'onwaytech.com.br',
  'www.onwaytech.com.br',
  'app.onwaytech.com.br',
])

// Paths que pertencem ao app e nunca devem ser interpretados como tenant slug.
const APP_PATHS = new Set([
  'landing', 'checkout', 'entrar', 'login', 'signup', 'esqueci-senha',
  'atualizar-senha', 'auth', 'termos', 'privacidade', 'votar',
  'condominios', 'unidades', 'pessoas', 'veiculos', 'pets',
  'ocorrencias', 'multas', 'notificacoes', 'regimento', 'painel',
  'encomendas', 'plantao', 'mural', 'calendario', 'dashboard',
  'votacoes', 'assembleias', 'templates', 'chamados', 'relatorios',
  'emails-log', 'chat', 'whatsapp', 'whatsapp-config', 'auditoria',
  'servicos', 'acessos', 'classificados', 'funcionalidades', 'planos',
  'solicitacoes', 'ajuda', 'comunicados', 'mais', 'meu-perfil',
  'fila-envios', 'c', 'comecar',
])

/**
 * Detecta slug do condominio pela URL atual:
 *   1. path curto (/:slug) → 'slug'  (ex.: onwaycondominio.com/jardim-paulista)
 *   2. path prefixado (/c/:slug/...) → 'slug'  (legado / alias)
 *   3. subdominio (jardim-paulista.onwaytech.com.br) → 'slug'
 *   4. retorna null se for host neutro ou nenhum match
 */
export function detectTenantSlug(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname.toLowerCase()
  const path = window.location.pathname

  // Path curto /<slug> — segmento único, excluindo paths do próprio app
  const shortMatch = path.match(/^\/([a-z0-9][a-z0-9-]{0,62})(\/|$)/i)
  if (shortMatch) {
    const candidate = shortMatch[1].toLowerCase()
    if (!APP_PATHS.has(candidate)) return candidate
  }

  // Path prefixado /c/<slug>/... (legado / alias)
  const prefixMatch = path.match(/^\/c\/([a-z0-9][a-z0-9-]{0,62})(\/|$)/i)
  if (prefixMatch) return prefixMatch[1].toLowerCase()

  // Subdominio: separa antes do dominio raiz
  if (NEUTRAL_HOSTS.has(host)) return null
  const parts = host.split('.')
  if (parts.length < 3) return null
  const sub = parts[0]
  if (sub === 'www' || sub === 'app') return null
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

/** Remove o cache de brand do tenant armazenado no localStorage. */
export function clearTenantCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignora
  }
}

/**
 * Resolve brand pelo id (usado quando o user logado tem condominio_id mas
 * acessou pelo dominio raiz ou trocou de condo via view-as).
 */
export async function loadTenantBrandById(id: string): Promise<TenantBrand | null> {
  try {
    const { data, error } = await supabase.rpc('condominio_brand_by_id', { p_id: id })
    if (!error && Array.isArray(data) && data.length > 0) {
      return data[0] as TenantBrand
    }
  } catch (e) {
    console.warn('[tenant] brand by id falhou:', e)
  }
  return null
}

/**
 * Converte hex (#1D4ED8) em "29 78 216" pra usar em rgb() do Tailwind via CSS var.
 * Aceita 3 ou 6 chars (com ou sem #). Retorna null em formato invalido.
 */
export function hexToRgbTriplet(hex: string | null): string | null {
  const rgb = hexToRgb(hex)
  return rgb ? `${rgb[0]} ${rgb[1]} ${rgb[2]}` : null
}

function hexToRgb(hex: string | null): [number, number, number] | null {
  if (!hex) return null
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Gera paleta brand-50..950 a partir de uma cor base, ajustando luminosidade.
 * A cor base e usada como brand-700 (cor principal). Demais tons saem dela.
 */
export function gerarPaletaBrand(hex: string | null): Record<number, string> | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  // Mapa tom -> luminosidade alvo (% L em HSL). Calibrado pelos defaults Tailwind.
  const Ls: Record<number, number> = {
    50: 97,
    100: 93,
    200: 86,
    300: 76,
    400: 65,
    500: 53,
    600: 45,
    700: 38,   // base (cor escolhida)
    800: 31,
    900: 24,
    950: 14,
  }
  const out: Record<number, string> = {}
  for (const [tomStr, L] of Object.entries(Ls)) {
    const tom = Number(tomStr)
    // Pra tons claros, reduz saturacao um pouco; pra tons escuros, mantem.
    const sAjustada = tom <= 200 ? Math.max(s * 0.6, 20) : s
    const [r, g, b] = hslToRgb(h, sAjustada, L)
    out[tom] = `${r} ${g} ${b}`
  }
  return out
}
