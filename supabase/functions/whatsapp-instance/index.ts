// supabase/functions/whatsapp-instance/index.ts
// Provisiona/gerencia a instância WhatsApp (Evolution API) de UM condomínio.
// Servidor Evolution é único (env EVOLUTION_API_URL + EVOLUTION_API_KEY); cada
// condomínio tem sua própria instância nomeada `condo_<id>`.
//
// Body: { condominio_id: uuid, action: 'connect' | 'status' | 'logout' | 'delete' }
//   connect -> cria a instância se não existir, registra webhook e devolve o QR
//   status  -> estado da conexão (open/connecting/close) e sincroniza ativo
//   logout  -> desconecta o número (mantém a instância)
//   delete  -> remove a instância
// Auth: JWT de staff do condomínio.

import { getCaller, assertSameScope, canManagePessoas, HttpError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const EVOLUTION_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

function evoHeaders() {
  return { 'content-type': 'application/json', apikey: EVOLUTION_KEY }
}

function instanceName(condominioId: string): string {
  return `condo_${condominioId}`
}

async function evoFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers: { ...evoHeaders(), ...(init?.headers ?? {}) },
  })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return jsonResponse({ error: 'Servidor WhatsApp não configurado (EVOLUTION_API_URL/KEY).' }, 500)
    }

    const caller = await getCaller(req)
    const body = await req.json().catch(() => ({})) as { condominio_id?: string; action?: string }
    const condominioId = body.condominio_id
    const action = body.action ?? 'connect'
    if (!condominioId) return jsonResponse({ error: 'condominio_id obrigatório.' }, 400)

    assertSameScope(caller, condominioId)
    if (!canManagePessoas(caller.perfil.role)) {
      return jsonResponse({ error: 'Sem permissão para gerenciar o WhatsApp deste condomínio.' }, 403)
    }

    const inst = instanceName(condominioId)
    const admin = caller.admin

    // Lê/garante a linha de config do condomínio
    const { data: cfg } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('condominio_id', condominioId)
      .maybeSingle()

    let webhookSecret: string = cfg?.webhook_secret ?? crypto.randomUUID()

    // ---------- DELETE ----------
    if (action === 'delete') {
      await evoFetch(`/instance/delete/${inst}`, { method: 'DELETE' })
      await admin.from('whatsapp_config').update({ ativo: false }).eq('condominio_id', condominioId)
      return jsonResponse({ ok: true, deleted: true })
    }

    // ---------- LOGOUT ----------
    if (action === 'logout') {
      await evoFetch(`/instance/logout/${inst}`, { method: 'DELETE' })
      await admin.from('whatsapp_config').update({ ativo: false }).eq('condominio_id', condominioId)
      return jsonResponse({ ok: true, status: 'close' })
    }

    // ---------- STATUS ----------
    if (action === 'status') {
      const st = await evoFetch(`/instance/connectionState/${inst}`)
      const state: string = st.data?.instance?.state ?? st.data?.state ?? 'close'
      const conectado = state === 'open'
      await admin
        .from('whatsapp_config')
        .update({ ativo: conectado })
        .eq('condominio_id', condominioId)
      return jsonResponse({ ok: true, status: state, conectado })
    }

    // ---------- CONNECT (default) ----------
    // 1) cria a instância se ainda não existe
    const fetchAll = await evoFetch(`/instance/fetchInstances?instanceName=${inst}`)
    const existe = Array.isArray(fetchAll.data) && fetchAll.data.length > 0
    if (!existe) {
      // Cria a instância. Se já existir (corrida/race), o Evolution devolve erro
      // de "already in use" — tratamos como benigno e seguimos pro connect.
      await evoFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: inst,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      })
    }

    // 2) registra o webhook (mensagens recebidas -> nossa edge)
    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?secret=${webhookSecret}`
    await evoFetch(`/webhook/set/${inst}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          base64: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    })

    // 3) persiste config (upsert) antes de devolver o QR
    await admin.from('whatsapp_config').upsert({
      condominio_id: condominioId,
      provider: 'evolution',
      api_url: EVOLUTION_URL,
      instance_id: inst,
      api_token: null,
      webhook_secret: webhookSecret,
      ativo: false,
    }, { onConflict: 'condominio_id' })

    // 4) busca o QR / pairing code
    const conn = await evoFetch(`/instance/connect/${inst}`)
    const qrBase64: string | null =
      conn.data?.base64 ?? conn.data?.qrcode?.base64 ?? null
    const pairingCode: string | null =
      conn.data?.pairingCode ?? conn.data?.qrcode?.pairingCode ?? null

    // Pode já estar conectado (sem QR)
    const st = await evoFetch(`/instance/connectionState/${inst}`)
    const state: string = st.data?.instance?.state ?? st.data?.state ?? 'connecting'
    if (state === 'open') {
      await admin.from('whatsapp_config').update({ ativo: true }).eq('condominio_id', condominioId)
    }

    return jsonResponse({
      ok: true,
      instance: inst,
      status: state,
      qr_base64: qrBase64,
      pairing_code: pairingCode,
    })
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
