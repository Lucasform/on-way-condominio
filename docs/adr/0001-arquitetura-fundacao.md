# ADR 0001 — Arquitetura de fundação (OnWay Condomínio)

Status: aceito · Data: 2026-06-23

Registro das decisões de arquitetura já tomadas no produto. Append-only: novas
decisões entram como ADR 0002, 0003, etc. Replica o padrão de ADRs do On Education.

## Contexto

Web app de gestão de condomínios (ocorrências, multas, comunicação) multi-tenant,
com IA que analisa ocorrência e gera minuta de multa a partir do regimento.

## Decisões

1. **Stack:** React + Vite + TypeScript no front, Supabase (Postgres, Auth, Storage,
   Realtime, Edge Functions) no backend, Tailwind para estilo, Vercel para deploy.
   *Por quê:* velocidade de entrega, um único provedor de backend, custo baixo no início.

2. **Multi-tenant por `condominio_id` + RLS desde o dia 1.** Toda tabela de negócio
   carrega `condominio_id` e tem policy de Row Level Security.
   *Consequência:* isolamento garantido no banco; nenhuma tabela de negócio sem policy.

3. **Segredos e IA só em Edge Functions.** Chaves (Claude, Resend, service_role)
   nunca no front. O front (Vite) expõe apenas `VITE_SUPABASE_URL` e `ANON_KEY`.
   *Consequência:* superfície de exposição mínima no cliente.

4. **IA com RAG + human-in-the-loop.** A análise de ocorrência busca os artigos
   relevantes do regimento (pgvector) e envia só eles ao modelo; a saída é JSON
   estruturado e a multa nunca é aplicada sem revisão humana. Haiku para tarefas
   simples, Sonnet para análise e redação.
   *Consequência:* multa fundamentada e auditável; depende de bom conteúdo de regimento.

## Consequências gerais

- Forte acoplamento ao Supabase (trade-off aceito pela velocidade).
- Edge Functions adicionam complexidade de deploy, compensada pela segurança.
- Novas decisões relevantes devem virar ADR aqui, não ficar só no código.
