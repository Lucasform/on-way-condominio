# `_shared/` — Utilitários compartilhados entre Edge Functions

Este diretório contém módulos reutilizados por múltiplas Edge Functions.
Nenhum deles é deployado individualmente como função.

---

## `cors.ts`

Headers CORS e helpers de response para chamadas browser.

| Export | Descrição |
|---|---|
| `corsHeaders` | Objeto com os headers `Access-Control-Allow-*` padrão |
| `handleCors(req)` | Responde preflight OPTIONS; retorna `null` para outros métodos |
| `jsonResponse(body, status?)` | Serializa `body` como JSON com CORS e content-type corretos |

**Uso típico em uma Edge Function:**
```ts
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  // ... lógica
  return jsonResponse({ ok: true })
})
```

---

## `auth.ts`

Identificação do caller e controle de acesso por role.

| Export | Descrição |
|---|---|
| `getCaller(req)` | Valida JWT, carrega perfil ativo, devolve `Caller` com clients Supabase prontos |
| `canManagePessoas(role)` | True para roles com poder de gerenciar pessoas |
| `canCreateRole(callerRole, targetRole)` | Verifica se o caller pode convidar alguém com o role alvo |
| `assertSameScope(caller, condominio_id)` | Lança 403 se o caller não tiver acesso ao condomínio |
| `audit(caller, req, input)` | Grava entrada no `audit_log` (fire-and-forget) |
| `HttpError` | Erro com `status` HTTP para respostas de erro padronizadas |

**Interfaces exportadas:** `Role`, `CallerPerfil`, `Caller`, `AuditInput`

---

## `rate-limit.ts`

Rate limiting de chamadas à IA — 30 chamadas/hora/usuário por padrão.
Usa a RPC `ia_consume_rate_limit` (definida em `0060_ia_rate_limit.sql`).
Comportamento fail-open: se não conseguir resolver o usuário, permite a chamada.

| Export | Descrição |
|---|---|
| `consumeIaRateLimit(authHeader, limit?)` | Consome uma chamada do bucket do usuário; retorna `allowed`, `remaining` e `reset_at` |
| `RateLimitResult` | Interface do retorno da função acima |

---

## `log.ts`

Logger estruturado para Edge Functions. Emite uma linha JSON por evento,
compatível com o Logs Explorer do Supabase. Gera `request_id` automático por instância.

| Export | Descrição |
|---|---|
| `Logger` | Classe de log. Instanciar uma vez por request. |
| `logger.with(extra)` | Anota contexto adicional (user_id, condominio_id etc.) para logs seguintes |
| `logger.debug/info/warn/error(msg, data?)` | Métodos de log por nível |

**Uso típico:**
```ts
import { Logger } from '../_shared/log.ts'

const log = new Logger('nome-da-funcao')
log.with({ user_id: caller.userId })
log.info('operacao iniciada', { param: value })
```

---

## `email-templates.ts`

Templates de e-mail transacional em PT-BR com shell HTML responsivo.
Templates mantidos em código para o MVP; candidatos a migrar para tabela quando
administradores precisarem de customização.

| Export | Descrição |
|---|---|
| `renderTemplate(slug, vars, custom?)` | Renderiza um template e retorna `RenderedEmail` com from/subject/html/text |
| `TemplateSlug` | Union type dos slugs disponíveis |
| `TemplateVars` | Variáveis de substituição (morador, condomínio, valores, links etc.) |
| `RenderedEmail` | Tipo do objeto retornado, pronto para envio via Resend |

**Slugs disponíveis:**

| Slug | Quando usar |
|---|---|
| `multa-aplicada` | Notificar morador sobre multa registrada |
| `encomenda-chegou` | Avisar morador sobre encomenda ou comida na portaria |
| `mural-nova-publicacao` | Notificar publicação no mural do condomínio |
| `evento-lembrete` | Lembrete de evento no calendário |
| `boas-vindas` | E-mail de boas-vindas ao criar conta |
| `custom` | Conteúdo livre (requer `{ subject, html }` no terceiro parâmetro) |
