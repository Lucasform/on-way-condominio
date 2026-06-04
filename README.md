# OnWay Condomínio

Web app multi-tenant de gestão administrativa de condomínios: ocorrências, multas com IA (análise do regimento via RAG), notificações, chat interno, encomendas/portaria, mural, calendário, votações/assembleias, chamados, relatórios PDF, acessos autorizados, classificados, comunicados e **WhatsApp** (conexão por QR + inbox + automações).

Isolamento por condomínio via **RLS** do Postgres. Cada tabela de negócio tem `condominio_id` e policies.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind 3 + React Router 7
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **IA:** Claude API (Sonnet pra análise de multa, Haiku pro resto) via Edge Functions
- **E-mail:** Resend (domínio `onwaytech.com.br`)
- **Push:** Web Push (W3C/VAPID)
- **WhatsApp:** Evolution API self-host (Railway) — ver `Integrações`
- **Deploy:** Vercel (frontend, auto no push `main`) + Supabase (backend)

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis abaixo
npm run dev                   # http://localhost:5173
```

Build de produção: `npm run build` (roda `tsc -b` + `vite build`).

## Variáveis de ambiente

Frontend (`.env.local`, prefixo `VITE_`):

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon/publishable key |

Server-side (secrets das Edge Functions — **nunca** com prefixo VITE):

| Secret | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (análise, chat, templates) |
| `RESEND_API_KEY` | Envio de e-mail |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | Servidor WhatsApp (Evolution) |

## Banco de dados (migrations)

Schema versionado em `supabase/migrations/` (`0001` → `0085+`). Aplicar uma migration:

```bash
SUPABASE_DB_PASSWORD=... SUPABASE_PROJECT_REF=... \
  node scripts/apply-migration.mjs supabase/migrations/00XX_nome.sql
```

> Host do pooler: `aws-1-sa-east-1.pooler.supabase.com` (porta 5432, user `postgres.<ref>`). O `aws-0` dá "tenant not found"; o host direto `db.<ref>` é IPv6-only.

## Edge Functions

Em `supabase/functions/`. **Deploy automático** via GitHub Actions (`.github/workflows/deploy-edges.yml`) no push a `main` que tocar `supabase/functions/**` — só redeploya as funções alteradas. Requer os secrets do repo `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`. Deploy manual de uma função: Actions → Run workflow → nome da função.

Principais: `analyze-ocorrencia` (IA+RAG, prompt caching), `chat-bot`, `improve-template`, `suggest-chat-reply`, `generate-comunicado`, `triage-chamado`, `parse-condominio-pdf`, `send-email`, `send-push`, `whatsapp-instance`/`whatsapp-send`/`whatsapp-webhook`, e os `cron-*` (agendados via pg_cron).

## Integrações

- **IA (RAG):** regimento é dividido em artigos, embeddings via pgvector; a análise busca os artigos relevantes e envia ao Claude. Saída JSON estruturada com revisão humana obrigatória.
- **WhatsApp:** servidor Evolution único no Railway atende todos os condomínios; cada condo conecta seu número por QR em `/whatsapp-config` e usa o inbox em `/whatsapp`. Detalhes e blueprint de reuso na doc interna.

## Estrutura

```
src/
  components/   componentes reutilizáveis (ui/, AppShell, etc.)
  pages/        páginas roteadas
  lib/          supabase client, helpers e libs de domínio
  hooks/        hooks customizados
  types/        tipos TypeScript
supabase/
  functions/    Edge Functions (+ _shared/)
  migrations/   schema versionado
scripts/        apply-migration.mjs, seed, update-auth-templates, etc.
```

## Convenções

- TypeScript em tudo; sem `any` sem motivo. Textos de UI em PT-BR.
- Toda tabela de negócio: `id`, `condominio_id`, `created_at` + RLS ativa.
- Chaves de API só no servidor (Edge Functions/secrets), nunca no front nem no Git.
