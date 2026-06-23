# CLAUDE.md — Contexto Técnico do Projeto

> Este arquivo é lido automaticamente pelo Claude Code em cada sessão.
> Ele define COMO o projeto deve ser construído. O que e em que ordem
> construir está em `ROADMAP.md`.

---

## 1. Visão geral

**OnWay Condomínio** é um web app de gestão administrativa de condomínios.
Foco em **ocorrências, multas, notificações e comunicação**, com **IA** que
analisa ocorrências e gera multas/notificações a partir do regimento interno.

- **Não tem** controle de acesso físico / portaria eletrônica.
- **Não tem** módulo financeiro (boletos, cobrança, pagamentos).
- Multa registra apenas a **decisão** (valor + status), nunca uma transação.

Diferencial de mercado: nenhum concorrente faz geração de multa por IA.

---

## 2. Stack obrigatória

| Camada        | Tecnologia                                              |
|---------------|---------------------------------------------------------|
| Frontend      | React + Vite + TypeScript                               |
| Estilo        | Tailwind CSS                                            |
| Navegação     | React Router (`react-router-dom`)                       |
| Backend / BD  | Supabase (Postgres, Auth, Storage, Realtime, Edge Func) |
| Busca semântica | pgvector (extensão do Postgres no Supabase)           |
| IA            | Claude API (chamada a partir de Edge Functions)         |
| E-mail        | Resend (domínio `onwaytech.com.br`)                     |
| Hospedagem    | Vercel (frontend) + Supabase (backend)                  |
| Pacotes       | npm                                                     |
| App de loja   | Capacitor (fase futura)                                 |

**Não trocar de stack sem instrução explícita.**

---

## 3. Arquitetura

### 3.1 Multi-tenant desde o dia 1
- O produto é multi-tenant (vários condomínios isolados).
- **Toda tabela de negócio carrega a coluna `condominio_id`.**
- O isolamento é garantido por **RLS (Row Level Security)** do Postgres.
- No início o app opera com 1 condomínio, mas o modelo já é multi-tenant.
- NUNCA criar tabela de negócio sem `condominio_id` e sem policy de RLS.

### 3.2 Camadas
- **Frontend (React):** telas, formulários, navegação por perfil.
- **Supabase:** banco, autenticação, storage de arquivos, Realtime.
- **Edge Functions:** lógica sensível e integrações (Claude API, envio de
  e-mail, processamento em massa). Chaves de API ficam SEMPRE no servidor,
  nunca no frontend.

### 3.3 IA
- O agente de IA roda em Edge Functions, nunca no cliente.
- Análise de ocorrência usa **RAG**: busca os artigos relevantes do
  regimento daquele condomínio (via pgvector) e envia só eles ao modelo.
- Saída do modelo é sempre **JSON estruturado** (infração, artigo,
  valor sugerido, minuta, grau de confiança).
- **Human-in-the-loop obrigatório:** a IA nunca aplica multa sozinha.
  Sempre há uma tela de revisão humana antes do envio.
- Roteamento de modelo: **Haiku** para tarefas simples (chat, triagem,
  classificação) e **Sonnet** para análise de multa e redação.

---

## 4. Perfis de acesso

| Perfil                     | Escopo      | Resumo                                    |
|----------------------------|-------------|-------------------------------------------|
| Administrador OnWay        | Plataforma  | Dono do SaaS. Gerencia todos os condomínios, planos, faturamento, config global. Único com visão multi-condomínio. |
| Administradora do condomínio | Condomínio | Empresa que administra o condomínio. Mesmas funções do síndico. |
| Síndico                    | Condomínio  | Gestão do condomínio: ocorrências, multas, comunicados, chat. |
| Portaria                   | Condomínio  | Registra encomendas/entregas e ocorrências. |
| Ronda                      | Condomínio  | Registra ocorrências.                     |
| Morador                    | Unidade     | Vê multas, contesta, usa o chat.          |

Administradora e síndico só enxergam o próprio condomínio. Visão
consolidada de vários condomínios é exclusiva do Administrador OnWay.

---

## 5. Estrutura de pastas

```
src/
  components/   # componentes reutilizáveis de UI
  pages/        # telas (uma por rota)
  lib/          # client do Supabase, helpers, configs
  hooks/        # hooks customizados de React
  types/        # tipos TypeScript (incl. tipos do banco)
  assets/       # imagens e estáticos
supabase/
  functions/    # Edge Functions
  migrations/   # migrations de banco (schema versionado)
```

---

## 6. Convenções de código

- **TypeScript em tudo.** Sem `any` sem justificativa.
- Componentes em PascalCase; hooks com prefixo `use`.
- Um componente por arquivo.
- Tailwind para estilo — evitar CSS solto.
- Nomes de variáveis e funções em inglês; textos de interface em
  português (PT-BR).
- Código limpo, comentários só onde a lógica não é óbvia.
- Tratar estados de carregamento e erro em toda chamada ao Supabase.

### Banco de dados
- Tabelas e colunas em `snake_case`, no plural (`condominios`, `multas`).
- Toda tabela de negócio: `id` (uuid), `condominio_id`, `created_at`.
- Schema versionado em `supabase/migrations` — nunca alterar o banco
  "na mão" sem registrar a migration.
- RLS ativo em todas as tabelas de negócio.

---

## 7. Segurança (regras inegociáveis)

- Chaves de API (Claude, Resend) ficam apenas em Edge Functions /
  variáveis de ambiente do servidor. NUNCA no frontend nem no Git.
- `.env.local` está no `.gitignore`. Versionar apenas `.env.example`.
- RLS sempre ativo — nenhuma tabela de negócio acessível sem policy.
- Não armazenar dados sensíveis de pagamento (não há módulo financeiro).
- Validar entradas no frontend e também no banco/Edge Function.

---

## 8. Variáveis de ambiente

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Variáveis usadas só no servidor (Edge Functions), nunca com prefixo VITE:
```
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

---

## 9. Como trabalhar (fluxo de desenvolvimento)

- **Uma etapa do ROADMAP.md por vez.** Não adiantar etapas futuras.
- Antes de codar uma etapa, confirmar o escopo dela com o usuário.
- Construir em **fatias verticais**: uma funcionalidade completa e
  testável por vez.
- Testar cada peça antes de seguir para a próxima.
- Fazer commit no Git a cada bloco que funcionar (mensagens claras).
- Para qualquer ação que o Claude Code não consiga executar sozinho
  (criar contas, ações no navegador, autenticações), **parar e explicar
  ao usuário o passo a passo manual**, aguardando confirmação.
- Ao concluir uma etapa, marcar o checkbox correspondente no `ROADMAP.md`.

## 10. O que NÃO fazer

- Não criar funcionalidades fora da etapa atual.
- Não criar tabela de negócio sem `condominio_id` + RLS.
- Não colocar chave de API no frontend.
- Não trocar a stack definida.
- Não implementar WhatsApp (fora de escopo no momento).
- Não implementar módulo financeiro.

---

## 11. Domínio do produto

Conhecimento de domínio (base legal de condomínios, limites de multa, governança,
edge cases) em [`DOMINIO.md`](DOMINIO.md). **Consultar antes de implementar lógica de
ocorrência, multa ou comunicação** — é o que impede a IA de sugerir valor/decisão ilegal.

---

## 12. Ritual de pré-mortem / advogado do diabo (obrigatório)

Antes de qualquer mudança significativa (feature, schema, integração):

1. **Pré-mortem:** "6 meses no futuro, isso falhou. Quais as 3 causas mais prováveis?"
2. **Advogado do diabo:** pedir ao Claude para argumentar CONTRA a ideia e achar
   evidência que a refute, não que a confirme. Postura padrão: cético.
3. **Premissas:** listar as 3 premissas de que a ideia mais depende; o que precisa
   ser verdade, e o que acontece se não for.
4. Só prosseguir se as respostas não derrubarem a ideia. Registrar no `ROADMAP.md`
   ou no doc da decisão.
