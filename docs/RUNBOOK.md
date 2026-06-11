# Runbook — OnWay Condomínio (operação e incidentes)

Guia objetivo pra quando algo der errado em produção. Leia antes de precisar.

## Onde está tudo
- **Frontend:** Vercel (auto-deploy do `main`) → https://on-way-condominio.vercel.app
- **Backend:** Supabase projeto `lkxnngzgmyfqgbbpmjvc` (região sa-east-1)
- **Edges:** `supabase/functions/*` (deploy via CLI ou GitHub Actions)
- **Migrations:** `supabase/migrations/*` (aplicar com `node scripts/apply-migration.mjs <arquivo>`)

## Monitoramento (já automático)
- Cron **`monitor-saude`** roda diário 12h UTC e, se houver e-mails falhos, envios esgotados na fila ou ocorrências sem análise IA, **avisa o admin OnWay** (sininho + push) com link pra `/fila-envios`.
- **Tela `/fila-envios`** (staff): mostra envios que falharam, o motivo traduzido e botão de reenviar.
- **Smoke test:** `npm run smoke` confere que as edges críticas estão de pé (rodar após cada deploy).

## Sintomas → o que fazer

### "Avisos não estão chegando" (e-mail/WhatsApp)
1. Abrir **/fila-envios** e ver o motivo.
   - *Canal WhatsApp desconectado* → reconectar em **/whatsapp-config** (escanear QR).
   - *E-mail recusado* → e-mail do morador inválido; corrigir cadastro.
   - *Falha temporária* → o reprocessador (cron 3min) tenta de novo sozinho; ou clicar "Reenviar".
2. Conferir secrets no Supabase: `RESEND_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`.

### "A IA não analisa a ocorrência"
- Na tela da ocorrência, clicar **Analisar** (fallback manual sempre existe).
- Conferir secret `ANTHROPIC_API_KEY` no Supabase e o rate-limit (`ia_rate_limit`).

### "Uma edge está com erro 500"
1. `npm run smoke` pra localizar qual.
2. Ver logs no Dashboard Supabase → Edge Functions → a função → Logs.
3. Corrigir e redeployar: `npx supabase functions deploy <nome> --project-ref lkxnngzgmyfqgbbpmjvc --no-verify-jwt`.

### "Site fora do ar"
- Ver o último deploy na Vercel (Deployments). Se um deploy quebrou, **Rollback** pro anterior (Vercel guarda o histórico — 1 clique).

## Deploy (como publicar)
- **Frontend:** `git push` no `main` → Vercel publica sozinho.
- **Edges (hoje manual):** `npx supabase functions deploy <nome> --project-ref lkxnngzgmyfqgbbpmjvc --no-verify-jwt`.
  - Pra automatizar: adicionar os secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` no GitHub (Settings → Secrets → Actions). Aí o `.github/workflows/deploy-edges.yml` deploya sozinho no push.

## Backup e restauração (Supabase)
- **Backup:** o Supabase faz backup automático diário (plano atual: retenção limitada). Conferir em Dashboard → Database → Backups.
- **Antes de qualquer migration de risco:** baixar um dump manual:
  `pg_dump` via Dashboard → Database → Backups → ou conexão direta (host pooler `aws-1-sa-east-1.pooler.supabase.com`).
- **Restaurar (procedimento a TESTAR com o Lucas antes de precisar):**
  1. Dashboard → Database → Backups → escolher ponto → Restore (cuidado: sobrescreve).
  2. Alternativa cirúrgica: restaurar tabela específica de um dump com `psql`.
- ⚠️ **Pendência:** fazer um **teste de restauração** num ambiente à parte pra validar o procedimento (não testado ainda).

## Segredos / acessos
- Credenciais (DB password, access token) em `[[reference-supabase-credentials-onway]]` (memória) e `CREDENCIAIS-ACESSO.txt` (gitignored).
- Rotacionar o `SUPABASE_ACCESS_TOKEN` em Dashboard → Account → Access Tokens se vazar.
