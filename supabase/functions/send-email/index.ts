// supabase/functions/send-email/index.ts
// Envia e-mail via Resend e registra na tabela `emails`.
// Body: { to: string | string[], template: TemplateSlug, vars?: TemplateVars, condominio_id?: uuid, custom?: { subject, html, text? } }
// Auth: JWT válido (user logado OU service_role pra triggers internas).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  renderTemplate,
  type TemplateSlug,
  type TemplateVars,
} from '../_shared/email-templates.ts'

interface Body {
  to: string | string[]
  template: TemplateSlug
  vars?: TemplateVars
  condominio_id?: string
  custom?: { subject: string; html: string; text?: string }
  reply_to?: string                                  // sobrescreve; senão usa email_contato do condo
  attachments?: Array<{ filename: string; content: string }>  // content = base64
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return jsonResponse({ error: 'RESEND_API_KEY não configurada.' }, 500)

    const body = (await req.json()) as Body
    const recipients = Array.isArray(body.to) ? body.to : [body.to]
    if (recipients.length === 0) return jsonResponse({ error: 'to vazio.' }, 400)
    if (!body.template) return jsonResponse({ error: 'template obrigatório.' }, 400)

    // Service role pra inserir/atualizar em emails (bypass RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve quem está enviando: pega o user via JWT do header e o nome_exibicao
    // do perfil. Se body.vars.sender_name vier preenchido, respeita.
    let senderName: string | null = body.vars?.sender_name ?? null
    let senderUserId: string | null = null
    try {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } },
      )
      const { data: who } = await userClient.auth.getUser()
      const uid = who?.user?.id ?? null
      senderUserId = uid
      if (uid && !senderName) {
        const { data: p } = await admin
          .from('perfis')
          .select('nome_exibicao')
          .eq('id', uid)
          .maybeSingle()
        if (p?.nome_exibicao) senderName = p.nome_exibicao
      }
    } catch (_) {
      // ignora — segue com fallback
    }

    const finalVars: TemplateVars = { ...(body.vars ?? {}), sender_name: senderName }
    const rendered = renderTemplate(body.template, finalVars, body.custom)

    // Reply-To = e-mail do condomínio (quando houver), pra respostas irem pra ele
    let replyTo: string | null = body.reply_to ?? null
    if (!replyTo && body.condominio_id) {
      const { data: condo } = await admin
        .from('condominios').select('email_contato').eq('id', body.condominio_id).maybeSingle()
      if (condo?.email_contato) replyTo = condo.email_contato
    }

    const results: Array<{ to: string; ok: boolean; id?: string; error?: string }> = []

    for (const to of recipients) {
      // Pré-insere log com status pending
      const { data: emailRow, error: insErr } = await admin
        .from('emails')
        .insert({
          condominio_id: body.condominio_id ?? null,
          para: to,
          assunto: rendered.subject,
          html: rendered.html,
          texto: rendered.text,
          template_slug: body.template,
          status: 'pending',
          enviado_por: senderUserId,
        })
        .select('id')
        .single()

      if (insErr) {
        results.push({ to, ok: false, error: insErr.message })
        continue
      }

      // Chama Resend
      try {
        const rendaResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: rendered.from,
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...(replyTo ? { reply_to: replyTo } : {}),
            ...(body.attachments && body.attachments.length
              ? { attachments: body.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
              : {}),
          }),
        })
        const data = await rendaResp.json()

        if (rendaResp.ok) {
          await admin
            .from('emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              resend_id: data?.id ?? null,
              tentativas: 1,
            })
            .eq('id', emailRow.id)
          results.push({ to, ok: true, id: data?.id })
        } else {
          await admin
            .from('emails')
            .update({
              status: 'failed',
              erro: JSON.stringify(data).slice(0, 1000),
              tentativas: 1,
            })
            .eq('id', emailRow.id)
          results.push({ to, ok: false, error: data?.message ?? `HTTP ${rendaResp.status}` })
        }
      } catch (e) {
        await admin
          .from('emails')
          .update({
            status: 'failed',
            erro: e instanceof Error ? e.message : String(e),
            tentativas: 1,
          })
          .eq('id', emailRow.id)
        results.push({ to, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const ok = results.filter((r) => r.ok).length
    const fail = results.length - ok
    return jsonResponse({ total: results.length, ok, fail, results })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
