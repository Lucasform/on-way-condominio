# OnWay Condomínio — ROADMAP

## FASE 15 — Leva planejada por sessões

Roadmap específico das levas atuais. Cada leva = 1 commit + push.

### Leva A — Email manual + TemplatePicker
- [x] A1. TemplatePicker plugado no compose de e-mail
- [x] A2. Compose manual `+ Novo e-mail` em `/emails-log` (pessoa ou unidade, assunto, corpo, TemplatePicker, "Melhorar com o Agente")
- [x] A3. Broadcast "Enviar pra todos" no compose
- [x] A4. Nome do remetente = `nome_exibicao` do staff (não mais "OnWay Condomínio" fixo)

### Leva B — IA no chat + ocorrências automáticas
- [x] B1. Botão "✨ Sugerir resposta" no ChatConversa (staff) com edge function
- [x] B2. TemplatePicker no envio direto do chat staff
- [x] B3. `analyze-ocorrencia` fire-and-forget em `createOcorrencia`
- [x] B4. Badge "✓ analisada" no card lista Ocorrências

### Leva C — Push + crons
- [x] C1. `notifyMoradorChatPush` confirmado + título personalizado com nome do staff
- [x] C2. Cron diário `notify-eventos-amanha` (eventos 24h)
- [x] C3. Cron `notify-votacoes` (abertura/encerramento)
- [x] C4. Cron `notify-encomendas-paradas` (> 7 dias)

### Leva D — Chat UX
- [x] D1. Marcar `mensagens.lida_em` ao abrir conversa
- [x] D2. Filtro/busca por nome do morador em `/chat`
- [x] D3. Atribuir conversa (assignee) `atribuida_para`

### Leva E — Filtros + bulk + foto ocorrência
- [x] E1. Filtros por data (de/até) em `/multas`, `/notificacoes`, `/encomendas`, `/chamados`
- [x] E2. Bulk em `/multas` (arquivar), `/notificacoes` (arquivar), `/chamados` (cancelar), `/encomendas` (devolver — checkbox por card aguardando no kanban e lista de comidas)
- [x] E3. Foto na ocorrência — já estava implementado (bucket `ocorrencia-fotos`, upload em OcorrenciaNova, exibição em OcorrenciaDetalhe). Verificado.

### Leva F — Polish UI
- [x] F1. `Skeleton` component criado + `TableSkeleton` + `CardListSkeleton`; aplicado em Multas, Notificações (via DataTable), Ocorrências, Chamados, Encomendas, EmailsLog, Chat. Outras listas seguem com texto "Carregando..." e podem migrar progressivamente.
- [x] F2. TemplatePicker passa a usar `w-[90vw]` em mobile (mantém `max-w-xl` + `max-h-[80vh]`).
- [x] F3. Padronização Button: refatorados 13 botões inline em 10 arquivos (PessoasImport, FornecedoresImport, VeiculosImport, UnidadesImport, CondominioAnexosManager, TwoFactorPanel, EsqueciSenha, MeuPerfil, AuthCallback, Encomendas — kanban + lista comidas). AuthProvider/RecoveryScreen mantido inline pra evitar dependência circular. Botões violeta "✨ Sugerir/Melhorar com Agente" mantidos com estilo próprio (semantic IA).
- [x] F4. Rate limit IA (30/hora/user) via tabela `ia_rate_limit` + RPC `ia_consume_rate_limit`; plugado em `analyze-ocorrencia`, `improve-template` e `suggest-chat-reply`.

### Leva M — Onboarding refinado (entregue 2026-05-28, commits `85de704`→`e19b59f`)
- [x] M1. Edge `delete-user-account` (admin/sindico/subsindico) + botão "🗑 Excluir" na aba "Sem cadastro" de /pessoas. Envia email Resend custom explicando remoção.
- [x] M2. Convites com vínculo inicial: `convites_condominio.{unidade_id,setor,pessoa_nome,tipo_vinculo}` (migration 0067). ConvitesPanel ganha toggle "+ Vincular já" pra travar.
- [x] M3. Signup 2 etapas: valida código → mostra contexto + campos coerentes com role. RPC `listar_unidades_de_convite` (anti-enumeração: só responde se código válido). Edge `redeem-invite-code` cria perfil + pessoa numa transação.
- [x] M4. `FuncionariosImport.tsx` (XLSX/CSV, dedup por CPF/email, undo via batch). `pessoas.setor` (migration 0073). PessoaForm troca "Relação" por "Setor" quando tipo_vinculo=funcionario. Aba Funcionários mostra coluna Setor.
- [x] M5. Layout fix: Dashboard/Painel/Calendario com `mx-auto`. EsqueciSenha copy reescrito em 3 linhas.
- [x] M6. pg_cron ajustado: notify-votacoes a cada 5min com janela 2h (em vez de 24h); notify-encomendas-paradas a cada 2h; assembleia-lembretes 08h diário; cron-{auditoria,multa,pet,votacao-eventos} desagendados (edges seguem deployadas pra invocação manual). Migrations 0069/0070/0072.
- [x] M7. SMTP custom Resend ativado em Supabase Auth (sender `nao-responda@onwaytech.com.br`).

### Pendente (não iniciado)
- [x] Customizar 5 templates HTML do Supabase Auth (Confirm signup, Magic Link, Change Email, Reset Password, Invite user) — branding OnWay (fundo escuro, violeta, sem "Supabase").
- [x] Refactor multi-condomínio (`perfis_condominios`) + perfil Parceiro (migration 0105, Parceiros.tsx, SignupParceiro.tsx, edge `redeem-plataforma-invite`).
- [x] Polish: trocar `alert/confirm/prompt` por modal/toast — PromptProvider + usePrompt criados; todos os window.prompt/confirm/alert substituídos (Pessoas, MeuPerfil, AcessoDetalhe, CondominioAnexosManager, CondominioFornecedoresPage, EmailsLog, Painel).
- [x] ConvitesPanel: badge "🏠 Unidade X / 👷 Setor Y / 👤 Nome" abaixo do código quando vier travado.

---

## BACKLOG — Melhorias inspiradas no Evercol (estudo 2026-06-25)

> Estudo completo do repositório `Catalisa/evercol` (NestJS + Next.js + Prisma, multi-tenant enterprise).
> Cada item abaixo é acionável para o OnWay Condomínio com a stack atual (React + Supabase + TypeScript).
>
> **Legenda esforço:** XS < 1h · P = 1–4h · M = 4–12h · G = 1–3 dias · GG = semana+
> **Legenda impacto:** Baixo · Médio · Alto · Crítico
> **Legenda prioridade:** 🔴 Urgente · 🟡 Alta · 🟢 Normal · ⚪ Backlog
> **Legenda tipo:** 🔒 Segurança · ✨ UX · ⚡ Perf · 🏗️ Arquitetura · 💎 Produto

### Grupo 1 — Segurança

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| G1 | **Proteção força bruta no login** — 5 tentativas falhas = lock 15 min. Campo `locked_until` em `perfis`, verificado antes do Supabase `signIn`. Desbloqueia automaticamente ao expirar. | 🔒 | P | Alto | 🔴 Urgente | G |
| G2 | **2FA TOTP via Supabase Auth** — habilitar MFA no dashboard + tela de setup em Meu Perfil (QR code + 6 backup codes de uso único). Obrigatório para admin_onway e parceiro. | 🔒 | P | Médio | 🟡 Alta | G |
| G3 | **Anti-enumeração no "esqueci senha"** — copy padronizado ("se o e-mail existir…"), Edge Function sempre responde ok independente do e-mail existir ou não. | 🔒 | XS | Médio | 🟡 Alta | G |
| G4 | **Session idle timeout** — 30 min sem atividade = logout automático. Crítico para terminais compartilhados (portaria, ronda). `lastActivity` em sessionStorage + listener `mousemove/keydown`. | 🔒 | P | Alto | 🔴 Urgente | G |

### Grupo 2 — UX e Navegação

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| H1 | **Command Palette (Cmd+K)** — modal global de busca por página/rota, morador por nome, unidade por número. Navegação por teclado (setas + Enter + Esc). | ✨ | M | Alto | 🟡 Alta | H |
| H2 | **Branding pré-paint por condomínio** — script inline no `index.html` lê o slug da URL e aplica CSS vars antes do React montar. Elimina flash de tema no carregamento pelo `slug`. | ✨ | P | Médio | 🟡 Alta | H |
| H3 | **Page Toolbar padronizado** — componente `<PageToolbar title subtitle action secondaryActions />` com colapso "⋯ Mais" no mobile. Substituir os `<div className="flex...">` repetidos em cada página. | ✨ | M | Médio | 🟢 Normal | H |
| H4 | **Filtros persistentes na URL** — status, data, busca como query params (`?status=aberta&from=2026-01-01`). Permite compartilhar link de filtro e voltar sem perder o contexto. | ✨ | M | Alto | 🟡 Alta | H |
| H5 | **Empty states com CTA contextual** — padronizar todas as páginas: ícone + texto + botão de ação primária quando lista vazia. Ex: `/multas` vazia → "Nenhuma multa registrada · + Registrar multa". | ✨ | P | Médio | 🟢 Normal | H |

### Grupo 3 — Performance

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| K1 | **Cache SWR custom para leituras recorrentes** — `swrStore` com TTL 30–60s para dados que não mudam a cada click (lista de unidades, condominios, pessoas). Invalida por prefixo ao mutar. Reduz chamadas redundantes ao Supabase. | ⚡ | M | Alto | 🟡 Alta | K |
| K2 | **Debounce em todos os campos de busca** — hoje alguns campos buscam em cada keystroke. Padronizar `useDebounce(300ms)` em todos os inputs de filtro/busca do app. | ⚡ | P | Médio | 🟡 Alta | K |
| K3 | **Renovação silenciosa de sessão** — renovar access token a cada 10 min de uso ativo (via `setInterval` + `supabase.auth.refreshSession()`). Evita expiração silenciosa mid-action. | ⚡ | P | Alto | 🟡 Alta | K |

### Grupo 4 — Relatórios e Exportação

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| L1 | **CSV export com BOM UTF-8 em todas as listas** — botão "Exportar CSV" em Multas, Ocorrências, Chamados, Pessoas, Encomendas. BOM `﻿` no início para Excel abrir sem problema de acento. | 💎 | P | Alto | 🟡 Alta | L |
| L2 | **Presets de período nas listagens** — chips rápidos "Hoje · 7d · 30d · Mês · Trimestre" ao lado dos filtros de data. Evita o usuário preencher datas manualmente. | ✨ | P | Médio | 🟡 Alta | L |
| L3 | **Report Builder no-code** — página `/relatorios/builder`: escolhe fonte (Multas, Ocorrências, Chamados, Pessoas), seleciona colunas, aplica filtros, agrupa por campo, exporta CSV. Diferencial para síndicos que precisam de BI simples. | 💎 | GG | Alto | 🟢 Normal | L |
| L4 | **Relatório narrativo por período** — resumo textual automático mensal: "Em junho: 12 ocorrências, 3 multas aplicadas (R$ 1.800), 8 chamados — 2 abertos". Gerado por IA (Haiku) ou por template simples. | 💎 | M | Alto | 🟢 Normal | L |

### Grupo 5 — Dashboard e Analytics

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| N1 | **Charts SVG sem biblioteca** — gráficos Donut (multas por status) e Bars (ocorrências por mês) implementados com SVG/CSS puro. Sem recharts, sem bundle extra. Leves e customizáveis. | ✨ | M | Alto | 🟡 Alta | N |
| N2 | **Dashboard configurável por role** — síndico escolhe quais widgets KPI aparecer no seu painel. Morador tem painel diferente (débitos, avisos, próximos eventos). Portaria vê encomendas e acessos. | 💎 | G | Alto | 🟢 Normal | N |
| N4 | **Painel de Atalhos personalizáveis** — seção "Atalhos" no topo do dashboard com checkboxes de ações frequentes. Cada role tem seu catálogo: síndico (Registrar multa, Nova ocorrência, Convocar assembleia, Enviar comunicado…), portaria (Nova encomenda, Registrar acesso, Abrir chamado…), morador (Abrir chamado, Ver débitos, Votar…). Usuário marca os que quer; ficam como botões de 1 clique com ícone. Salvo em `perfis.shortcuts: string[]`. | ✨ | M | Alto | 🟡 Alta | N |
| N3 | **Event tracking fire-and-forget** — `trackEvent('multa.criada')`, `trackEvent('ocorrencia.analisada_ia')` via `POST /analytics` com `keepalive: true`. Permite ver quais features são mais usadas por condomínio. | 🏗️ | M | Médio | 🟢 Normal | N |

### Grupo 6 — Arquitetura e DX

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| I1 | **DataScope formalizado nas RLS** — morador vê só seus registros (ocorrências por `created_by`, multas por `unidade_id`, chamados por `created_by`). Hoje parcialmente feito, formalizar policies explícitas. | 🏗️ | M | Alto | 🟡 Alta | I |
| I2 | **Auditoria centralizada via helper** — `logAction({ entity, action, entityId, diff })` chamado por todas as Edge Functions. Substitui chamadas manuais dispersas. Painel de auditoria fica muito mais completo. | 🏗️ | M | Alto | 🟡 Alta | I |
| I3 | **Feature flags configuráveis pelo síndico** — UI de toggle em Configurações: síndico habilita/desabilita módulos (WhatsApp, Acessos, Classificados) sem precisar de admin_onway. | 💎 | M | Médio | 🟢 Normal | I |

### Grupo 7 — Workflows

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| W1 | **Aprovação de multas (SoD)** — multa acima de limiar configurável vai para `PENDING_APPROVAL` antes de notificar o morador. Quem registra ≠ quem aprova. Síndico aprova/rejeita com comentário. | 💎 | G | Alto | 🟢 Normal | W |
| W2 | **Aprovação de chamados com custo** — chamado com custo estimado ≥ limiar precisa de ok do síndico antes de acionar fornecedor. Status: DRAFT → PENDING → APPROVED → IN_PROGRESS → DONE. | 💎 | G | Médio | 🟢 Normal | W |

### Grupo 8 — Produto Avançado (backlog)

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| J1 | **Campos personalizáveis por condomínio** — síndico cria campos extras em Unidade, Pessoa e Ocorrência (TEXT, NUMBER, DATE, SELECT). Tabelas `campos_extras_defs` + `campos_extras_valores`. Diferencial de produto real. | 💎 | GG | Alto | ⚪ Backlog | J |
| J2 | **Assinatura de entrega de encomenda** — canvas com Pointer Events (mouse/touch) para morador assinar ao retirar pacote. Salva como PNG em Storage. Útil juridicamente. | 💎 | M | Médio | ⚪ Backlog | J |
| J3 | **Scanner de código de barras em encomendas** — BarcodeDetector API (Chrome/Android) para portaria ler código de rastreio. Fallback: digitar manualmente. | 💎 | M | Médio | ⚪ Backlog | J |
| J4 | **Demo mode** — quando condomínio sem dados, exibe dados de exemplo (moradores fictícios, ocorrências, multas) para trial e demonstração comercial. Toggle via feature flag. | 💎 | G | Alto | ⚪ Backlog | J |

---

### Leva G — Segurança

- [x] G1. Proteção força bruta no login — 5 tentativas = lock 15 min (localStorage por e-mail, frontend-only)
- [x] G2. 2FA TOTP — Supabase Auth MFA habilitado + `TwoFactorPanel` em Meu Perfil + gate `MfaBanner` para admin_onway + challenge no Login
- [x] G3. Anti-enumeração "esqueci senha" — catch sempre chama `setSent(true)`, nunca expõe se e-mail existe
- [x] G4. Session idle timeout — 30 min sem atividade = logout automático (sessionStorage `onway:last-activity` + listeners)

### Leva H — UX e Navegação

- [x] H1. Command Palette (Cmd+K / Ctrl+K) — modal global com busca por rota, navegação por teclado (↑↓ Enter Esc)
- [x] H2. Branding pré-paint — `<style>html,body,#root{background:#080d1a}</style>` no `index.html` elimina flash branco
- [x] H3. PageHeader ganha `secondaryActions` — colapsa em "⋯ Mais" no mobile, exibe inline no sm+
- [x] H4. Filtros persistentes na URL — Chamados: status/prio/cat/q/de/ate via `useSearchParams` com `replace:true`
- [x] H5. Empty states com CTA — Multas, Chamados, Ocorrências, Notificações com ícone + hint + botão contextual

### Leva K — Performance

- [x] K1. Cache TTL custom — `src/lib/cache.ts` (Map + TTL); `listUnidades` + `listCondominios` cacheiam chamadas no-opts por 60s
- [x] K2. Debounce padronizado — `useDebounce(300ms)` em Chamados, Pessoas e demais campos de busca
- [x] K3. Renovação silenciosa de sessão — `supabase.auth.refreshSession()` a cada 10 min via `setInterval` em AuthProvider

### Leva L — Relatórios e Exportação

- [x] L1. CSV export com BOM UTF-8 — botão "↓ CSV" em Multas, Ocorrências, Chamados, Pessoas, Encomendas, Notificações
- [x] L2. Presets de período — chips Hoje/7d/30d/Este mês em Multas, Chamados, Encomendas, Notificações
- [ ] L3. Report Builder no-code — `/relatorios/builder` (GG esforço — não iniciado)
- [x] L4. Relatório narrativo — banner de stats em Multas: "X multas · Y aplicadas · Z em análise · W contestadas"

### Leva N — Dashboard e Analytics

- [x] N1. Charts SVG sem biblioteca — `DonutChart` com arc path SVG; integrado em Multas como widget de status
- [ ] N2. Dashboard configurável por role — widgets diferentes por role (não iniciado)
- [x] N3. Event tracking — `trackEvent()` via `navigator.sendBeacon` fire-and-forget; backend `/api/analytics` a ligar
- [x] N4. Painel de Atalhos personalizáveis — `ShortcutsBar` no topo do Painel; catálogo por role; localStorage por userId

### Leva I — Arquitetura

- [ ] I1. DataScope nas RLS — formalizar policies de morador ver só seus registros (requer migration SQL)
- [x] I2. Helper `logAction()` centralizado — `src/lib/logAction.ts` fire-and-forget para `audit_log`; frontend e Edge Functions
- [ ] I3. Feature flags por síndico — UI de toggle por condomínio (requer tabela `condo_feature_overrides`, migration)

### Leva W — Workflows de Aprovação

- [ ] W1. Aprovação de multas com SoD — PENDING_APPROVAL + tela de revisão + segregação de função (requer migration)
- [ ] W2. Aprovação de chamados com custo — limiar configurável + fluxo de aprovação pelo síndico (requer migration)

### Leva J — Produto Avançado (backlog — não iniciar sem go)

- [ ] J1. Campos personalizáveis por condomínio — extras em Unidade, Pessoa, Ocorrência
- [ ] J2. Assinatura de entrega de encomenda — canvas touch, salva PNG no Storage
- [ ] J3. Scanner código de barras — BarcodeDetector API para rastrear encomendas na portaria
- [ ] J4. Demo mode — dados fictícios para trial e demonstração comercial
