interface CacheEntry<T> { data: T; expires: number }
const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry || Date.now() > entry.expires) { store.delete(key); return null }
  return entry.data
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs })
}

export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
