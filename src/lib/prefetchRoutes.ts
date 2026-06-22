// Prefetch silencioso dos chunks após o app carregar — garante navegação instantânea.
// Warm-up das Edge Functions para evitar cold start de 1-3s na primeira chamada.

const PREFETCH_FACTORIES: Array<() => Promise<unknown>> = [
  // Rotas principais (síndico / administradora)
  () => import('../pages/Dashboard'),
  () => import('../pages/Painel'),
  () => import('../pages/Ocorrencias'),
  () => import('../pages/Multas'),
  () => import('../pages/Notificacoes'),
  () => import('../pages/Encomendas'),
  () => import('../pages/Chat'),
  () => import('../pages/Mural'),
  () => import('../pages/Comunicados'),
  () => import('../pages/Chamados'),
  // Rotas secundárias
  () => import('../pages/Pessoas'),
  () => import('../pages/Unidades'),
  () => import('../pages/Calendario'),
  () => import('../pages/MeuPerfil'),
  () => import('../pages/Acessos'),
  () => import('../pages/Assembleias'),
  () => import('../pages/Votacoes'),
  () => import('../pages/Pets'),
  () => import('../pages/Veiculos'),
  () => import('../pages/Servicos'),
  () => import('../pages/Relatorios'),
  () => import('../pages/Regimento'),
  () => import('../pages/Templates'),
]

const EDGE_WARMUP_URL = 'https://lkxnngzgmyfqgbbpmjvc.supabase.co/functions/v1/health'
const WARMUP_INTERVAL_MS = 4 * 60 * 1000 // 4 min — abaixo do timeout de idle do Deno (5 min)

let prefetched = false

function warmupEdgeFunctions() {
  fetch(EDGE_WARMUP_URL, { method: 'GET', cache: 'no-store' }).catch(() => {})
}

export function prefetchRoutes() {
  if (prefetched) return
  prefetched = true

  const run = () => {
    // Warm-up imediato e depois a cada 4 minutos
    warmupEdgeFunctions()
    setInterval(warmupEdgeFunctions, WARMUP_INTERVAL_MS)

    // Prefetch de chunks: espaçados em 150ms cada pra não competir com renderização
    PREFETCH_FACTORIES.forEach((f, i) => {
      setTimeout(() => f().catch(() => {}), 800 + i * 150)
    })
  }

  if ('requestIdleCallback' in window) {
    ;(window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run)
  } else {
    setTimeout(run, 1500)
  }
}
