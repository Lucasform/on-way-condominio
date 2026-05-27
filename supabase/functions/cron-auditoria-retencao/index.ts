// supabase/functions/cron-auditoria-retencao/index.ts
// Cron mensal: aplica retencao de audit_log apagando registros > 12 meses.
// Aciona a funcao SQL audit_log_aplicar_retencao().
//
// Agendamento (SQL, uma vez):
//   select cron.schedule(
//     'auditoria-retencao-mensal',
//     '0 3 1 * *',                                       -- todo dia 1, 3h
//     $$ select net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/cron-auditoria-retencao',
//          headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role_key'))
//        ) $$
//   );

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(url, serviceKey)

    const meses = Number(new URL(req.url).searchParams.get('meses') ?? '12')
    const { data, error } = await sb.rpc('audit_log_aplicar_retencao', { meses })
    if (error) throw error

    return jsonResponse({ ok: true, meses, deletados: data ?? 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron-auditoria-retencao]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
