// N3: fire-and-forget event tracking — errors swallowed intentionally.
// Backend (/api/analytics) is wired up when ready; utility works now.
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    navigator.sendBeacon(
      '/api/analytics',
      JSON.stringify({ name, props, ts: new Date().toISOString() }),
    )
  } catch {
    // ignore
  }
}
