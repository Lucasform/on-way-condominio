// supabase/functions/monitor-saude/index.ts
// Cron diário: olha sinais REAIS de falha em prod e, se houver, avisa o
// admin OnWay (sininho + push). Sem instrumentar cada edge: usa os dados que
// já existem (emails falhos, fila de envio falha, ocorrências sem análise IA).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    const desde24h = new Date(Date.now() - 24 * 3600_000).toISOString()
    const ha2h = new Date(Date.now() - 2 * 3600_000).toISOString()

    const [rEmails, rEnvios, rIa] = await Promise.all([
      admin.from('emails').select('*', { count: 'exact', head: true })
        .eq('status', 'failed').gte('created_at', desde24h),
      admin.from('envio_fila').select('*', { count: 'exact', head: true })
        .eq('status', 'falhou').gte('updated_at', desde24h),
      // Ocorrência criada nas últimas 24h, com +2h e ainda sem análise IA = IA falhou/não rodou.
      admin.from('ocorrencias').select('*', { count: 'exact', head: true })
        .is('ia_analysis', null).gte('created_at', desde24h).lte('created_at', ha2h),
    ])
    const emailsFalhos = rEmails.count ?? 0
    const enviosFalhos = rEnvios.count ?? 0
    const iaPendentes = rIa.count ?? 0

    const problemas: string[] = []
    if (emailsFalhos > 0) problemas.push(`${emailsFalhos} e-mail(s) falharam`)
    if (enviosFalhos > 0) problemas.push(`${enviosFalhos} envio(s) esgotaram as tentativas`)
    if (iaPendentes > 0) problemas.push(`${iaPendentes} ocorrência(s) sem análise da IA`)

    if (problemas.length === 0) {
      return jsonResponse({ ok: true, saudavel: true })
    }

    const corpo = problemas.join(' · ')

    // Destinatários: admins OnWay (operadores da plataforma)
    const { data: admins } = await admin.from('perfis').select('id').eq('role', 'admin_onway').eq('ativo', true)
    const ids = (admins ?? []).map((a) => a.id as string)
    if (ids.length > 0) {
      await admin.from('app_notifications').insert(
        ids.map((uid) => ({
          user_id: uid,
          condominio_id: null,
          tipo: 'sistema',
          titulo: '⚠ Saúde do sistema (24h)',
          conteudo: corpo,
          link: '/fila-envios',
        })),
      )
      fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ user_ids: ids, titulo: '⚠ Saúde do sistema', corpo, link: '/fila-envios' }),
      }).catch(() => {})
    }

    return jsonResponse({ ok: true, saudavel: false, problemas, avisados: ids.length })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
