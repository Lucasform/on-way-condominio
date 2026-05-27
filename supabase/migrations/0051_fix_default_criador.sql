-- 0051_fix_default_criador.sql
-- Varias tabelas tinham coluna FK pra auth.users com
--   not null + default '00000000-0000-0000-0000-000000000000'::uuid
-- Esse UUID nao existe em auth.users, entao qualquer INSERT que nao
-- preenchesse a coluna disparava 23503 (foreign_key_violation).
--
-- Fix: torna a coluna nullable e remove o default. A lib do front
-- preenche com auth.uid() quando o usuario esta logado; se nao,
-- registra NULL e o ON DELETE de FK setou NULL.

-- ============================================================
-- 1) eventos.criado_por
-- ============================================================
alter table public.eventos alter column criado_por drop default;
alter table public.eventos alter column criado_por drop not null;
alter table public.eventos drop constraint if exists eventos_criado_por_fkey;
alter table public.eventos add constraint eventos_criado_por_fkey
  foreign key (criado_por) references auth.users(id) on delete set null;

-- ============================================================
-- 2) publicacoes.autor_id
-- ============================================================
alter table public.publicacoes alter column autor_id drop default;
alter table public.publicacoes alter column autor_id drop not null;
alter table public.publicacoes drop constraint if exists publicacoes_autor_id_fkey;
alter table public.publicacoes add constraint publicacoes_autor_id_fkey
  foreign key (autor_id) references auth.users(id) on delete set null;

-- ============================================================
-- 3) ocorrencias.reportado_por (0004)
-- ============================================================
alter table public.ocorrencias alter column reportado_por drop default;
alter table public.ocorrencias alter column reportado_por drop not null;
alter table public.ocorrencias drop constraint if exists ocorrencias_reportado_por_fkey;
alter table public.ocorrencias add constraint ocorrencias_reportado_por_fkey
  foreign key (reportado_por) references auth.users(id) on delete set null;

-- ============================================================
-- 4) multas.aplicada_por (0005)
-- ============================================================
alter table public.multas alter column aplicada_por drop default;
alter table public.multas alter column aplicada_por drop not null;
alter table public.multas drop constraint if exists multas_aplicada_por_fkey;
alter table public.multas add constraint multas_aplicada_por_fkey
  foreign key (aplicada_por) references auth.users(id) on delete set null;

-- ============================================================
-- 5) encomendas.recebido_por (0008)
-- ============================================================
alter table public.encomendas alter column recebido_por drop default;
alter table public.encomendas alter column recebido_por drop not null;
alter table public.encomendas drop constraint if exists encomendas_recebido_por_fkey;
alter table public.encomendas add constraint encomendas_recebido_por_fkey
  foreign key (recebido_por) references auth.users(id) on delete set null;

-- ============================================================
-- 6) votacoes.criado_por (0012)
-- ============================================================
alter table public.votacoes alter column criado_por drop default;
alter table public.votacoes alter column criado_por drop not null;
alter table public.votacoes drop constraint if exists votacoes_criado_por_fkey;
alter table public.votacoes add constraint votacoes_criado_por_fkey
  foreign key (criado_por) references auth.users(id) on delete set null;

-- ============================================================
-- 7) chamados.aberto_por (0013)
-- ============================================================
alter table public.chamados alter column aberto_por drop default;
alter table public.chamados alter column aberto_por drop not null;
alter table public.chamados drop constraint if exists chamados_aberto_por_fkey;
alter table public.chamados add constraint chamados_aberto_por_fkey
  foreign key (aberto_por) references auth.users(id) on delete set null;

-- ============================================================
-- 8) contestacoes.autor_id (0014)
-- ============================================================
alter table public.contestacoes alter column autor_id drop default;
alter table public.contestacoes alter column autor_id drop not null;
alter table public.contestacoes drop constraint if exists contestacoes_autor_id_fkey;
alter table public.contestacoes add constraint contestacoes_autor_id_fkey
  foreign key (autor_id) references auth.users(id) on delete set null;
