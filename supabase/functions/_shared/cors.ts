/** Headers CORS padrão para Edge Functions chamadas pelo browser. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

/**
 * Responde imediatamente a preflight OPTIONS com os headers CORS corretos.
 * @param req Request recebido pela Edge Function
 * @returns Response `200 ok` para OPTIONS, `null` para outros métodos
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

/**
 * Serializa `body` como JSON e retorna uma Response com headers CORS e content-type corretos.
 * @param body Valor a serializar
 * @param status HTTP status code (default: 200)
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
