-- Corrigir FKs de autor_id para referenciar perfis em vez de auth.users
-- Isso permite o join via PostgREST (perfis!fk_name)

alter table public.solicitacoes
  drop constraint if exists solicitacoes_autor_id_fkey,
  add constraint solicitacoes_autor_id_fkey
    foreign key (autor_id) references public.perfis(id) on delete cascade;

alter table public.solicitacao_mensagens
  drop constraint if exists solicitacao_mensagens_autor_id_fkey,
  add constraint solicitacao_mensagens_autor_id_fkey
    foreign key (autor_id) references public.perfis(id) on delete cascade;
