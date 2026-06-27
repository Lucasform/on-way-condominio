export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  shouldRetry?: (err: unknown) => boolean
}

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
