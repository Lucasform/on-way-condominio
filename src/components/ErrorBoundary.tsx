import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Caught:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        minHeight: '100vh',
      }}>
        <h1 style={{ fontSize: '20px', marginBottom: '12px', color: '#f87171' }}>
          ⚠ App quebrou
        </h1>
        <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
          Mostra esse erro pro Lucas:
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
        }}>
          <strong>{this.state.error?.name}: {this.state.error?.message}</strong>
          {'\n\n'}
          {this.state.error?.stack}
          {this.state.errorInfo?.componentStack && (
            <>{'\n\n--- Component stack ---\n'}{this.state.errorInfo.componentStack}</>
          )}
        </pre>
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
          Tente: Ctrl+Shift+R (hard refresh). Se persistir, screenshot dessa tela.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '12px',
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
      </div>
    )
  }
}
