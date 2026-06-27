interface CacheEntry<T> { data: T; expires: number }
const store = new Map<string, CacheEntry<unknown>>()

/**
 * Retorna o valor em cache associado a `key`, ou `null` se ausente ou expirado.
 * @param key Chave de cache
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry || Date.now() > entry.expires) { store.delete(key); return null }
  return entry.data
}

/**
 * Armazena `data` em cache sob `key` com um TTL em milissegundos.
 * @param key Chave de cache
 * @param data Valor a armazenar
 * @param ttlMs Tempo de vida em ms a partir do momento da chamada
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs })
}

/**
 * Remove todas as entradas cujas chaves começam com `prefix`.
 * Útil para invalidar um namespace inteiro (ex: `"assinatura:"`).
 * @param prefix Prefixo das chaves a remover
 */
export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
