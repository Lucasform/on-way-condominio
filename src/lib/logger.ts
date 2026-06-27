const isDev = import.meta.env.DEV

/**
 * Loga um erro no console apenas em desenvolvimento.
 * @param context Label que identifica o módulo ou operação (ex: "billing", "auth")
 * @param err Erro capturado
 */
export function logError(context: string, err: unknown): void {
  if (isDev) {
    console.error(`[${context}]`, err)
  }
}

/**
 * Loga um aviso no console apenas em desenvolvimento.
 * @param context Label que identifica o módulo ou operação
 * @param msg Mensagem de aviso
 */
export function logWarn(context: string, msg: string): void {
  if (isDev) {
    console.warn(`[${context}]`, msg)
  }
}
