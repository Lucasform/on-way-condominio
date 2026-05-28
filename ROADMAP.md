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
- [ ] Customizar 5 templates HTML do Supabase Auth (Confirm signup, Magic Link, Change Email, Reset Password, Invite user) — hoje rodam template default cinza com "Supabase" no rodapé.
- [ ] Refactor multi-condomínio (`perfis_condominios`) — Leva L original. Permite 1 user gerir N condos.
- [ ] Polish: trocar `alert/confirm/prompt` por modal/toast (incluindo `handleExcluirConta` em /pessoas).
- [ ] ConvitesPanel: badge "🏠 Unidade X / 👷 Setor Y / 👤 Nome" abaixo do código quando vier travado.
