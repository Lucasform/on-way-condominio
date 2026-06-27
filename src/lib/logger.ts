const isDev = import.meta.env.DEV

export function logError(context: string, err: unknown): void {
  if (isDev) {
    console.error(`[${context}]`, err)
  }
}

export function logWarn(context: string, msg: string): void {
  if (isDev) {
    console.warn(`[${context}]`, msg)
  }
}
