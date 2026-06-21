// health — endpoint de saúde para monitoramento externo (UptimeRobot, etc.)
// GET /functions/v1/health → { ok: true, db: true, ts: "<iso>" }
// Não exige autenticação (público).

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
    })
  }

  const start = Date.now()
  let dbOk = false
  let dbMs = 0

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { error } = await admin.from('feature_flags').select('key').limit(1)
    dbOk = !error
    dbMs = Date.now() - start
  } catch { /* dbOk permanece false */ }

  const status = dbOk ? 200 : 503
  const body = JSON.stringify({
    ok:    dbOk,
    db:    dbOk,
    db_ms: dbMs,
    ts:    new Date().toISOString(),
    version: Deno.env.get('DENO_DEPLOYMENT_ID') ?? 'local',
  })

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
})
