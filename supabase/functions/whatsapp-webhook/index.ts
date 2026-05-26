// supabase/functions/whatsapp-webhook/index.ts
// Endpoint público que o Z-API / Evolution chama quando uma mensagem chega no WhatsApp.
//
// Z-API URL no painel: https://lkxnngzgmyfqgbbpmjvc.supabase.co/functions/v1/whatsapp-webhook?secret=<webhook_secret>
//
// NÃO requer JWT (público), mas valida `?secret=` contra o whatsapp_config.webhook_secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// --- Adapter: extrai { telefone, texto, condominio_id_via_secret } ---
// Z-API webhook envia algo como:
//   { phone: "5511999999999", text: { message: "olá" }, instanceId: "...", messageId: "...", fromMe: false }
// Evolution:
//   { data: { key: { remoteJid: "5511999999999@s.whatsapp.net" }, message: { conversation: "olá" } } }
function parsePayload(body: unknown): { telefone: string | null; texto: string | null; fromMe?: boolean; messageId?: string } {
  // Z-API
  const zapi = body as { phone?: string; text?: { message?: string }; fromMe?: boolean; messageId?: string }
  if (zapi?.phone && (zapi.text?.message || typeof (zapi as Record<string, unknown>).message === 'string')) {
    return {
      telefone: String(zapi.phone),
      texto: zapi.text?.message ?? (zapi as Record<string, string>).message,
      fromMe: zapi.fromMe ?? false,
      messageId: zapi.messageId,
    }
  }
  // Evolution
  const evo = body as { data?: { key?: { remoteJid?: string; fromMe?: boolean; id?: string }; message?: { conversation?: string; extendedTextMessage?: { text?: string } } } }
  const jid = evo?.data?.key?.remoteJid
  const txt = evo?.data?.message?.conversation ?? evo?.data?.message?.extendedTextMessage?.text
  if (jid && txt) {
    return {
      telefone: jid.split('@')[0],
      texto: txt,
      fromMe: evo.data?.key?.fromMe ?? false,
      messageId: evo.data?.key?.id,
    }
  }
  return { telefone: null, texto: null }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    if (!secret) return jsonResponse({ error: 'Secret obrigatório (?secret=...)' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Localiza config pelo secret
    const { data: cfg, error: cfgErr } = await admin
      .from('whatsapp_config')
      .select('id, condominio_id, ativo')
      .eq('webhook_secret', secret)
      .maybeSingle()

    if (cfgErr || !cfg) return jsonResponse({ error: 'Secret inválido.' }, 401)
    if (!cfg.ativo) return jsonResponse({ skipped: true, reason: 'WhatsApp inativo.' })

    const body = await req.json()
    const parsed = parsePayload(body)
    if (!parsed.telefone || !parsed.texto) {
      return jsonResponse({ skipped: true, reason: 'Payload sem telefone/texto utilizáveis.' })
    }
    if (parsed.fromMe) {
      return jsonResponse({ skipped: true, reason: 'Mensagem enviada pelo próprio número (eco).' })
    }

    // Acha pessoa pelo telefone normalizado
    const telDigits = parsed.telefone.replace(/\D/g, '')
    const variantes = [telDigits, telDigits.replace(/^55/, '')]

    const { data: pessoa } = await admin
      .from('pessoas')
      .select('id, user_id, nome')
      .eq('condominio_id', cfg.condominio_id)
      .in('telefone', variantes)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

    if (!pessoa) {
      // Telefone desconhecido — registra mas não cria conversa nem dispara bot.
      // Síndico pode usar essa info pra cadastrar o morador.
      return jsonResponse({
        ok: true,
        warn: 'Telefone não encontrado em pessoas. Mensagem ignorada.',
        telefone: telDigits,
      })
    }

    if (!pessoa.user_id) {
      return jsonResponse({
        ok: true,
        warn: 'Pessoa encontrada mas sem user_id (morador não tem login). Bot não responde.',
      })
    }

    // Acha/cria conversa WhatsApp aberta
    let { data: conversa } = await admin
      .from('conversas')
      .select('id, status')
      .eq('condominio_id', cfg.condominio_id)
      .eq('morador_user_id', pessoa.user_id)
      .eq('canal', 'whatsapp')
      .neq('status', 'encerrada')
      .order('ultima_mensagem_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conversa) {
      const { data: novaConv, error: convErr } = await admin
        .from('conversas')
        .insert({
          condominio_id: cfg.condominio_id,
          morador_user_id: pessoa.user_id,
          assunto: 'outro',
          status: 'aberta',
          canal: 'whatsapp',
          wa_telefone: telDigits,
        })
        .select('id, status')
        .single()
      if (convErr) return jsonResponse({ error: `Falha ao criar conversa: ${convErr.message}` }, 500)
      conversa = novaConv
    }

    // Insere mensagem do morador
    await admin.from('mensagens').insert({
      conversa_id: conversa.id,
      autor_id: pessoa.user_id,
      autor_tipo: 'morador',
      conteudo: parsed.texto,
      metadata: {
        wa_message_id: parsed.messageId,
        wa_telefone: telDigits,
      },
    })

    // Dispara bot — fire and forget
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/chat-bot`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ conversa_id: conversa.id }),
    }).catch(() => {})

    return jsonResponse({ ok: true, conversa_id: conversa.id, pessoa: pessoa.nome })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
