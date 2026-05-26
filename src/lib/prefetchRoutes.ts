// Prefetch silencioso dos chunks mais usados após app carregar.
// Garante navegação instantânea pras rotas comuns.

const PREFETCH_FACTORIES: Array<() => Promise<unknown>> = [
  () => import('../pages/Dashboard'),
  () => import('../pages/Painel'),
  () => import('../pages/Pessoas'),
  () => import('../pages/Unidades'),
  () => import('../pages/Ocorrencias'),
  () => import('../pages/Multas'),
  () => import('../pages/Chamados'),
  () => import('../pages/Encomendas'),
  () => import('../pages/Mural'),
  () => import('../pages/Calendario'),
  () => import('../pages/MeuPerfil'),
]

let prefetched = false

export function prefetchRoutes() {
  if (prefetched) return
  prefetched = true
  const run = () => {
    PREFETCH_FACTORIES.forEach((f, i) => {
      // Espaça em 100ms cada pra não bloquear nada
      setTimeout(() => f().catch(() => {}), i * 100)
    })
  }
  if ('requestIdleCallback' in window) {
    ;(window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run)
  } else {
    setTimeout(run, 1500)
  }
}
