// supabase/functions/condominio-ai-chat/index.ts
// Chat geral com IA — importações, dúvidas sobre o sistema, assistente do condomínio.
// Body: { messages: [{role, content}][], system?: string }
// Modelo: claude-haiku-4-5 (baixo custo)

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { consumeIaRateLimit } from '../_shared/rate-limit.ts'

const CLAUDE_MODEL = 'claude-haiku-4-5'
const MAX_OUTPUT_TOKENS = 1024
const MAX_HISTORY = 20 // máx de mensagens enviadas pra não estourar contexto

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    // Chat usa rate limit próprio de 60 msgs/hora (mais liberal que o PDF)
    const rl = await consumeIaRateLimit(auth, 60)
    if (!rl.allowed) {
      return jsonResponse(
        { error: `Limite de mensagens atingido (60/hora). Tente após ${rl.reset_at ?? 'alguns minutos'}.` },
        429,
      )
    }

    const body = await req.json()
    const { messages, system } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      system?: string
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'messages obrigatório e não pode ser vazio.' }, 400)
    }

    const safeMessages = messages.slice(-MAX_HISTORY)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada.' }, 500)

    const systemPrompt = system?.trim() ||
      'Você é o assistente do OnWay Condomínio, um sistema de gestão condominial. ' +
      'Ajude o usuário com dúvidas sobre importação de dados, ocorrências, comunicados, multas e uso do sistema. ' +
      'Seja objetivo e responda em português brasileiro.'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        messages: safeMessages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return jsonResponse({ error: `Claude API ${res.status}: ${err.slice(0, 300)}` }, 502)
    }

    const data = await res.json()
    const reply: string = data?.content?.[0]?.text ?? ''

    return jsonResponse({
      reply,
      tokens: {
        input: data?.usage?.input_tokens ?? null,
        output: data?.usage?.output_tokens ?? null,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
