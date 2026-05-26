import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  recovering: boolean
}

const RELOAD_GUARD_KEY = 'onway:chunk_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('failed to fetch dynamic') ||
    msg.includes('importing a module script failed') ||
    msg.includes('chunkloaderror') ||
    err.name === 'ChunkLoadError'
  )
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, recovering: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, recovering: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Caught:', error, errorInfo)

    // Chunk antigo referenciado por HTML cacheado: o deploy novo invalidou esse arquivo.
    // Auto-recarrega uma vez (com guarda anti-loop) pra puxar HTML novo.
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0')
      const now = Date.now()
      if (now - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
        setTimeout(() => {
          const url = new URL(window.location.href)
          url.searchParams.set('_r', String(now))
          window.location.replace(url.toString())
        }, 1200)
      } else {
        // Já recarregamos recente e ainda quebrou. Sai do modo "recovering" pra mostrar erro.
        this.setState({ recovering: false })
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (isChunkLoadError(this.state.error) && this.state.recovering) {
      return (
        <div style={{
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
            <h1 style={{ fontSize: '18px', marginBottom: 8 }}>
              Atualizando o app
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              Detectamos uma versão nova. Recarregando automaticamente...
            </p>
          </div>
        </div>
      )
    }

    return (
      <div style={{
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        minHeight: '100vh',
      }}>
        <h1 style={{ fontSize: '20px', marginBottom: '12px', color: '#f87171' }}>
          ⚠ Algo deu errado
        </h1>
        <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
          Tente recarregar. Se continuar, limpe os dados e entre de novo.
        </p>
        <pre style={{
          backgroundColor: '#1e293b',
          padding: '12px',
          borderRadius: '6px',
          overflow: 'auto',
          fontSize: '12px',
          color: '#fbbf24',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: 240,
        }}>
          <strong>{this.state.error?.name}: {this.state.error?.message}</strong>
        </pre>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🔄 Recarregar
          </button>
          <button
            onClick={() => {
              try {
                Object.keys(localStorage).forEach((k) => {
                  if (k.startsWith('sb-') || k.includes('supabase') || k.startsWith('onway:')) localStorage.removeItem(k)
                })
                if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
                if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
              } finally {
                window.location.replace('/entrar')
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🧹 Limpar dados e entrar
          </button>
        </div>
      </div>
    )
  }
}
