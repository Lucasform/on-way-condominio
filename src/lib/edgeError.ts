// Helper para extrair a mensagem REAL de erro de uma Edge Function.
// O supabase-js, quando a function retorna non-2xx, devolve um erro genérico
// ("Edge Function returned a non-2xx status code") e guarda a resposta real
// em `error.context` (um Response). Aqui lemos o corpo pra mostrar a causa.

/**
 * Recebe o `error` retornado por `supabase.functions.invoke(...)` e devolve
 * a mensagem mais útil possível: o campo `error` do corpo JSON da function,
 * com fallback pro texto cru e, por último, a mensagem genérica.
 */
export async function edgeErrorMessage(error: unknown): Promise<string> {
  const genérico = error instanceof Error ? error.message : String(error)
  const ctx = (error as { context?: unknown })?.context
  if (ctx instanceof Response) {
    try {
      const txt = await ctx.clone().text()
      if (txt) {
        try {
          const json = JSON.parse(txt)
          if (json?.error) return String(json.error)
          if (json?.message) return String(json.message)
        } catch { /* não era JSON */ }
        return txt
      }
    } catch { /* corpo já consumido / ilegível */ }
  }
  return genérico
}
