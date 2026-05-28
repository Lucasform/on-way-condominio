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
