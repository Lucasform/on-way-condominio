import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { bootstrapTheme } from './lib/theme.ts'

// Sentry — ativo apenas quando VITE_SENTRY_DSN estiver nas env vars do Vercel.
// Para ativar: crie um projeto em sentry.io → copie o DSN → adicione em
// Vercel → Settings → Environment Variables → VITE_SENTRY_DSN
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /^Network Error$/,
      /ChunkLoadError/,
    ],
  })
}

// Aplica tema (dark/light) ANTES do React montar pra evitar flash.
bootstrapTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
