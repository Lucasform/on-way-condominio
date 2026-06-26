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

| # | Item | Tipo | Esforço | Impacto | Prioridade | Leva |
|---|------|------|---------|---------|------------|------|
| G1 | **Proteção força bruta no login** — 5 tentativas falhas = lock 15 min. Campo `locked_until` em `perfis`, verificado na Edge Function de login. | 🔒 | P | Alto | 🔴 Urgente | G |
| G2 | **2FA TOTP via Supabase Auth** — habilitar no dashboard + tela de setup em Meu Perfil (QR code + backup codes). Disponível para admin_onway e parceiro. | 🔒 | P | Médio | 🟡 Alta | G |
| G3 | **Anti-enumeração no "esqueci senha"** — garantir que o copy nunca vaza se e-mail existe. Revisar `EsqueciSenha.tsx` + padronizar resposta da Edge Function. | 🔒 | XS | Médio | 🟡 Alta | G |
| G4 | **Branding pré-paint por condomínio** — script inline no `index.html` lê o slug da URL e aplica CSS vars `--c-primary-*` antes do React montar. Elimina flash de tema no carregamento. | ✨ | P | Médio | 🟡 Alta | G |
| H1 | **Command Palette (Cmd+K)** — busca global por: página/rota, morador por nome, unidade por número. Abre modal com lista filtrada + navegação por teclado. | ✨ | M | Alto | 🟡 Alta | H |
| H2 | **Auditoria centralizada via helper** — `logAction({ entity, action, entityId, diff })` em todas as Edge Functions. Substitui as chamadas manuais dispersas. Painel de auditoria fica muito mais completo. | 🏗️ | M | Alto | 🟡 Alta | H |
| H3 | **Feature flags configuráveis pelo síndico** — expandir o `FeatureFlagsProvider` existente para ter UI de toggle em Configurações. Síndico habilita/desabilita módulos (WhatsApp, Acessos, Classificados) sem precisar de admin_onway. | 💎 | M | Médio | 🟢 Normal | H |
| I1 | **DataScope por role — morador vê só seus próprios registros** — ocorrências e multas do morador filtram por `created_by = auth.uid()` ou `unidade_id = perfil.unidade_id`. Hoje já acontece parcialmente; formalizar nas RLS policies. | 🏗️ | M | Alto | 🟡 Alta | I |
| I2 | **Workflow de aprovação em multas** — multa acima de um valor configurável vai para `PENDING_APPROVAL` antes de notificar o morador. Síndico aprova/rejeita. Segregação: quem registra ≠ quem aprova. | 💎 | G | Alto | 🟢 Normal | I |
| I3 | **Workflow de aprovação em chamados** — chamado com custo estimado ≥ limiar precisa de ok do síndico antes de contratar fornecedor. Status DRAFT → PENDING → APPROVED → IN_PROGRESS. | 💎 | G | Médio | 🟢 Normal | I |
| J1 | **Campos personalizáveis por condomínio** — síndico cria campos extras em Unidade, Pessoa e Ocorrência (TEXT, NUMBER, DATE, SELECT). Tabelas `campos_extras_defs` + `campos_extras_valores`. Diferencial de produto real. | 💎 | GG | Alto | ⚪ Backlog | J |

---

### Leva G — Segurança (próxima a executar)

- [ ] G1. Proteção força bruta no login — `perfis.locked_until`, bloqueia após 5 tentativas, desbloqueia automático após 15 min
- [ ] G2. 2FA TOTP — habilitar Supabase Auth MFA + tela setup em Meu Perfil (QR + 6 backup codes de uso único)
- [ ] G3. Anti-enumeração "esqueci senha" — revisar copy + garantir que Edge Function não vaza existência de e-mail
- [ ] G4. Branding pré-paint — script inline `index.html` aplica CSS vars do slug antes do React montar

### Leva H — UX Avançada

- [ ] H1. Command Palette (Cmd+K) — modal global de busca por página/morador/unidade com navegação por teclado
- [ ] H2. Helper `logAction()` centralizado — uma função, todas as Edge Functions chamam, auditoria completa automaticamente
- [ ] H3. Feature flags configuráveis — UI de toggle em Configurações do condomínio (módulos on/off pelo síndico)

### Leva I — Workflows e Permissões

- [ ] I1. DataScope formalizado — RLS policies explícitas para morador ver só seus registros (ocorrências, multas, chamados)
- [ ] I2. Aprovação de multas — status PENDING_APPROVAL + tela de revisão para síndico (segregação de função)
- [ ] I3. Aprovação de chamados — limiar de custo configurável + fluxo DRAFT → PENDING → APPROVED

### Leva J — Produto Avançado (backlog)

- [ ] J1. Campos personalizáveis por condomínio — UI de criação de campos extras em Unidade, Pessoa e Ocorrência
