/** Opções de configuração para `withRetry`. */
export interface RetryOptions {
  /** Número máximo de tentativas (default: 3). */
  attempts?: number
  /** Delay base em ms; dobra a cada tentativa com backoff exponencial (default: 400). */
  baseDelayMs?: number
  /** Predicate chamado com o erro para decidir se deve tentar novamente (default: sempre retenta). */
  shouldRetry?: (err: unknown) => boolean
}

/**
 * Executa `fn` com backoff exponencial em caso de falha.
 * Lança o último erro se todas as tentativas falharem ou se `shouldRetry` retornar false.
 * @param fn Função assíncrona a executar
 * @param opts Opções de retry (tentativas, delay base, predicado de retry)
 * @returns Resultado de `fn` na primeira tentativa bem-sucedida
 * @throws Último erro capturado após esgotar as tentativas
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, baseDelayMs = 400, shouldRetry = () => true } = opts
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i === attempts - 1 || !shouldRetry(err)) throw err
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw last
}

/**
 * Retorna true se o erro é de rede (offline ou timeout), candidato a retry.
 * @param err Erro capturado em um bloco catch
 */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  )
}

interface CircuitBreakerState {
  failures: number
  openUntil: number
}

const circuits = new Map<string, CircuitBreakerState>()

/**
 * Circuit breaker simples por chave. Após `threshold` falhas consecutivas,
 * abre o circuito por `cooldownMs` ms e lança erro imediatamente sem chamar `fn`.
 * Reseta ao ter sucesso.
 * @param key Identificador do circuito (ex: nome do serviço ou endpoint)
 * @param fn Função assíncrona protegida pelo circuito
 * @param opts `threshold` (default: 5 falhas) e `cooldownMs` (default: 30 000 ms)
 * @returns Resultado de `fn` quando o circuito está fechado
 * @throws Erro de circuito aberto quando dentro do período de cooldown
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  opts: { threshold?: number; cooldownMs?: number } = {}
): Promise<T> {
  const { threshold = 5, cooldownMs = 30_000 } = opts
  const state = circuits.get(key) ?? { failures: 0, openUntil: 0 }

  if (Date.now() < state.openUntil) {
    throw new Error(`[CircuitBreaker] ${key} aberto até ${new Date(state.openUntil).toISOString()}`)
  }

  try {
    const result = await fn()
    circuits.set(key, { failures: 0, openUntil: 0 })
    return result
  } catch (err) {
    const failures = state.failures + 1
    const openUntil = failures >= threshold ? Date.now() + cooldownMs : 0
    circuits.set(key, { failures, openUntil })
    throw err
  }
}
