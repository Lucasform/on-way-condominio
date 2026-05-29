-- 0077_avaliacoes_e_lista_negra.sql
-- Avaliacoes de fornecedores (1 a 5 estrelas + comentario).
-- Nome do arquivo mantido por compatibilidade com o commit anterior; a parte
-- de lista negra foi removida apos decisao do Lucas (2026-05-29): nao bloquear
-- por lista, a propria expiracao da autorizacao + nao renovacao pelo morador
-- ja resolve.

create table public.fornecedor_avaliacoes (
  id              uuid primary key default gen_random_uuid(),
  fornecedor_id   uuid not null
                  references public.condominio_fornecedores(id) on delete cascade,
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  estrelas        integer not null check (estrelas between 1 and 5),
  comentario      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (fornecedor_id, user_id)
);

create index fornecedor_avaliacoes_fornecedor_idx
  on public.fornecedor_avaliacoes (fornecedor_id);

create trigger trg_fornecedor_avaliacoes_updated_at
before update on public.fornecedor_avaliacoes
for each row execute function public.set_updated_at();

alter table public.fornecedor_avaliacoes enable row level security;
alter table public.fornecedor_avaliacoes force row level security;

create policy fornecedor_avaliacoes_select on public.fornecedor_avaliacoes
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy fornecedor_avaliacoes_insert on public.fornecedor_avaliacoes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and condominio_id in (select public.user_condominios())
  );

create policy fornecedor_avaliacoes_update on public.fornecedor_avaliacoes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy fornecedor_avaliacoes_delete on public.fornecedor_avaliacoes
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );
