import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'

// Mock Sentry so it doesn't blow up in tests
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}))

// Suppress React's error boundary console output during tests
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

// Component that renders normally
function NormalChild() {
  return <div data-testid="child-content">Conteúdo filho</div>
}

// Component that always throws
function ThrowingChild({ shouldThrow }: { shouldThrow?: boolean }) {
  if (shouldThrow !== false) {
    throw new Error('Erro de teste do componente')
  }
  return <div>Ok</div>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <NormalChild />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo filho')).toBeInTheDocument()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    // Should display the error heading
    expect(screen.getByText(/algo deu errado/i)).toBeInTheDocument()
  })

  it('displays the error message in the fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Erro de teste do componente/i)).toBeInTheDocument()
  })

  it('does not render children after an error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
  })
})
