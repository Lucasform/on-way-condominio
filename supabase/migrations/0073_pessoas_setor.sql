-- 0073_pessoas_setor.sql
-- Adiciona coluna setor em pessoas pra funcionarios (Portaria, Limpeza, etc).
-- Coluna opcional e livre, sem catalogo fixo nesta fase.

alter table public.pessoas
  add column if not exists setor text;

create index if not exists pessoas_setor_idx
  on public.pessoas (condominio_id, setor)
  where setor is not null;
