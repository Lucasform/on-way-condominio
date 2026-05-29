-- 0076_publicacoes_story.sql
-- Suporte a "story" no mural: publicacao com prazo de validade.
-- expira_em null = post normal sem prazo.
-- expira_em preenchido = story (default 24h).
-- Lista filtra na UI (where expira_em is null OR expira_em > now()).

alter table public.publicacoes
  add column if not exists expira_em timestamptz;

create index if not exists publicacoes_expira_idx
  on public.publicacoes (condominio_id, expira_em)
  where expira_em is not null;
