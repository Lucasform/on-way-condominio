// supabase/functions/whatsapp-send/index.ts
// Envia mensagem WhatsApp via provider configurado (Z-API ou Evolution API).
// Body: { condominio_id: uuid, telefone: string (formato 5511999999999), texto: string, conversa_id?: uuid }
// Auth: JWT válido.
//
// Comportamento: se condomínio NÃO tem whatsapp_config.ativo, retorna 200 com skipped=true.
// Isso permite código cliente chamar sem se preocupar se o canal está configurado.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  condominio_id: string
  telefone: string
  texto: string
  conversa_id?: string
  documento?: { base64: string; filename: string }  // anexa PDF (Evolution sendMedia)
}

function normalizePhone(p: string): string {
  // Remove tudo que não é dígito; garante DDI 55 se faltar
  const digits = p.replace(/\D/g, '')
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const body = (await req.json()) as Body
    if (!body.condominio_id || !body.telefone || !body.texto) {
      return jsonResponse({ error: 'condominio_id, telefone e texto obrigatórios.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Busca config
    const { data: cfg, error: cfgErr } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('condominio_id', body.condominio_id)
      .maybeSingle()

    if (cfgErr) return jsonResponse({ error: cfgErr.message }, 500)
    if (!cfg || !cfg.ativo) {
      return jsonResponse({
        skipped: true,
        reason: 'WhatsApp não configurado/ativo neste condomínio.',
      })
    }
    if (!cfg.instance_id) {
      return jsonResponse({
        skipped: true,
        reason: 'Instância WhatsApp não definida.',
      })
    }

    // Servidor Evolution é único (env); z-api ainda lê credenciais da config.
    const evoUrl = (Deno.env.get('EVOLUTION_API_URL') ?? cfg.api_url ?? '').replace(/\/$/, '')
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') ?? cfg.api_token ?? ''

    const telefone = normalizePhone(body.telefone)

    let url: string
    let init: RequestInit

    if (cfg.provider === 'z-api') {
      if (!cfg.api_url || !cfg.api_token) {
        return jsonResponse({ skipped: true, reason: 'Credenciais Z-API incompletas.' })
      }
      // Z-API: POST https://api.z-api.io/instances/{id}/token/{token}/send-text
      url = `${cfg.api_url.replace(/\/$/, '')}/instances/${cfg.instance_id}/token/${cfg.api_token}/send-text`
      init = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Z-API exige Client-Token em conta Pro (header opcional pra free)
        },
        body: JSON.stringify({ phone: telefone, message: body.texto }),
      }
    } else if (cfg.provider === 'evolution') {
      if (!evoUrl || !evoKey) {
        return jsonResponse({ skipped: true, reason: 'Servidor Evolution não configurado.' })
      }
      if (body.documento?.base64) {
        // Documento (PDF): Evolution POST /message/sendMedia/{instance}
        url = `${evoUrl}/message/sendMedia/${cfg.instance_id}`
        init = {
          method: 'POST',
          headers: { 'content-type': 'application/json', apikey: evoKey },
          body: JSON.stringify({
            number: telefone,
            mediatype: 'document',
            mimetype: 'application/pdf',
            media: body.documento.base64,
            fileName: body.documento.filename,
            caption: body.texto,
          }),
        }
      } else {
        // Texto: Evolution POST /message/sendText/{instance}
        url = `${evoUrl}/message/sendText/${cfg.instance_id}`
        init = {
          method: 'POST',
          headers: { 'content-type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: telefone, text: body.texto }),
        }
      }
    } else {
      return jsonResponse({ error: `Provider desconhecido: ${cfg.provider}` }, 500)
    }

    const r = await fetch(url, init)
    const data = await r.json().catch(() => ({}))

    if (!r.ok) {
      // Detecta "número não tem WhatsApp" (Evolution: response.message[].exists=false)
      const raw = JSON.stringify(data)
      const semWhats = /"exists"\s*:\s*false/.test(raw)
      return jsonResponse({
        ok: false,
        provider: cfg.provider,
        status: r.status,
        reason: semWhats ? 'numero_sem_whatsapp' : 'erro_envio',
        error: semWhats ? 'Este número não tem conta no WhatsApp.' : raw.slice(0, 500),
      }, 200)
    }

    // Se foi parte de uma conversa, atualiza metadata da última msg
    if (body.conversa_id) {
      const messageId = data?.messageId ?? data?.id ?? data?.key?.id ?? null
      if (messageId) {
        await admin
          .from('mensagens')
          .update({ metadata: { wa_message_id: messageId, wa_provider: cfg.provider } })
          .eq('conversa_id', body.conversa_id)
          .eq('autor_tipo', 'staff')
          .order('created_at', { ascending: false })
          .limit(1)
      }
    }

    return jsonResponse({ ok: true, provider: cfg.provider, raw: data })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
