import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  tokens: { input: number | null; output: number | null }
}

export async function sendChatMessage(
  messages: ChatMessage[],
  system?: string,
): Promise<ChatResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  const res = await fetch(`${SUPABASE_URL}/functions/v1/condominio-ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, system }),
  })

  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Erro ${res.status} no assistente de IA.`)
  }

  if (!res.ok) {
    throw new Error((data?.error as string) ?? `Erro ${res.status} no assistente de IA.`)
  }

  return data as unknown as ChatResponse
}
