# MVP — Escopo, Segurança, Dívida técnica e Feedback (OnWay Condomínio)

Disciplina da etapa MVP do Founder's Playbook. Atualizado 2026-06-23.

---

## 1. Escopo (o que faz, o que NÃO faz)

### O produto faz
- Cadastro de condomínios, unidades, moradores, veículos e pets.
- Registro de ocorrências e geração de minuta de multa por IA (revisão humana).
- Comunicação: comunicados, mural, chat, e disparo no WhatsApp (Evolution).
- Notificações (push, e-mail via Resend) e reservas de áreas comuns.

### O produto NÃO faz (por decisão, não por falta de tempo)
- **Módulo financeiro** (boletos, cobrança, conciliação de pagamento). A multa
  registra só a decisão (valor + status), nunca uma transação financeira.
- Controle de acesso físico / portaria eletrônica (catraca, fechadura).
- Contabilidade do condomínio.

> Observação: o WhatsApp e o checkout Stripe (assinatura do SaaS) JÁ estão no
> escopo e implementados. A regra antiga no CLAUDE.md (§10) que dizia "não WhatsApp"
> está desatualizada e deve ser corrigida.

### Critério para adicionar uma feature nova
Só entra quando houver **evidência de usuário** de que o produto não entrega valor
sem ela (vários síndicos pedindo o mesmo), não por entusiasmo de momento. A pergunta
muda de "dá pra construir?" para "uma massa de usuários disse que não usa sem isso?".

## 2. Controle de scope creep
- Uma etapa do `ROADMAP.md` por vez; confirmar escopo antes de codar (regra do CLAUDE.md §9).
- Toda ideia nova passa pelo critério acima antes de virar trabalho.

## 3. Revisão de segurança (antes de usuários reais)
Checklist do estado atual:
- [x] RLS ativo em todas as tabelas de negócio (`condominio_id` + policy).
- [x] 2FA (TOTP) implementado, com banner de ativação.
- [x] Segredos só em Edge Functions / server; nada sensível em `VITE_`.
- [x] `.env.local` no `.gitignore` (verificado: não versionado).
- [x] Audit log de ações (ator, ação, alvo, IP).
- [ ] **Pendente:** habilitar `FORCE ROW LEVEL SECURITY` (backstop contra bypass).
- [ ] **Pendente:** tornar 2FA obrigatório para perfis administrativos.

## 4. Dívida técnica conhecida (logar sempre)
- Só há testes E2E (Playwright); faltam testes unitários da lógica em `src/lib`.
- `CLAUDE.md` §10 desatualizado (cita WhatsApp como fora de escopo, mas está dentro).
- Templates de e-mail do Supabase Auth pendentes (citado no ROADMAP).
> Regra: toda dívida assumida conscientemente entra aqui, com motivo e quando pagar.

## 5. Loop de feedback do usuário
- **Hoje:** moradores e síndicos falam pelo chat interno; não há intake estruturado.
- **Próximo passo (build curto):** tabela `feedback` (tipo, descrição, autor, condominio_id)
  + modal "Enviar feedback / reportar problema" + visão para o admin triar.
- Manter humano no loop para interpretar pedidos ("seria bom se..."): é dor central ou nice-to-have?

---

## 6. Etapas 3-4 — Launch & Scale (prontidão)

### 19. Produto aguenta carga de produção
- Stack gerenciada (Vercel + Supabase) escala bem no início.
- Monitoramento ativo: Sentry (erros), RUNBOOK de incidentes, `smoke` pós-deploy.
- Ação antes de campanha de aquisição: teste de carga nas Edge Functions de IA e WhatsApp.

### 20. Segurança e compliance (LGPD)
- Dados pessoais: moradores, unidades, ocorrências. Base legal: execução de contrato.
- RLS por `condominio_id`, 2FA (TOTP), audit log de ações, segredos só no servidor.
- Definir processo de direitos do titular (acesso/exclusão) e política de retenção.

### 24. Moat por profundidade de domínio
- `DOMINIO.md` externaliza base legal e limites de multa da vertical.
- Prática: cada edge case real (reincidência, locatário x proprietário) vira regra/validação no produto, o mapa do moat.

### 26. Workflow lock-in via integrações
- Integrações profundas: WhatsApp (Evolution), Stripe, Resend, Web Push, IA com RAG.
- Próximo nível: API/webhook para a administradora plugar seus sistemas (lock-in maior).

### 28. Codificar conhecimento institucional
- Conhecimento vive em: CLAUDE.md, ADRs (docs/adr), DOMINIO.md, ROADMAP, RUNBOOK, skills e memória.
- Mantém o conhecimento transferível e fora da cabeça do fundador.

> Dependem de build (não marcar verde sem código): 25 data flywheel; API pública (26).
