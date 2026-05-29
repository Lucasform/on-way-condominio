-- 0079_publicacao_enquete.sql
-- Enquete embutida na publicacao do mural. Sindico cria 2-4 opcoes;
-- moradores votam 1 vez (pode trocar). Resultado visivel pra todos.

alter table public.publicacoes
  add column if not exists enquete jsonb;
  -- formato: { pergunta?: string, opcoes: string[], encerra_em?: timestamptz }

create table if not exists public.publicacao_votos (
  publicacao_id   uuid not null
                  references public.publicacoes(id) on delete cascade,
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  opcao_idx       integer not null check (opcao_idx >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (publicacao_id, user_id)
);

create index if not exists publicacao_votos_pub_idx
  on public.publicacao_votos (publicacao_id);

create trigger trg_publicacao_votos_updated_at
before update on public.publicacao_votos
for each row execute function public.set_updated_at();

alter table public.publicacao_votos enable row level security;
alter table public.publicacao_votos force row level security;

-- SELECT: qualquer membro do condo da publicacao
create policy publicacao_votos_select on public.publicacao_votos
  for select to authenticated
  using (
    public.is_admin_onway()
    or exists (
      select 1 from public.publicacoes p
      where p.id = publicacao_votos.publicacao_id
        and p.condominio_id in (select public.user_condominios())
    )
  );

-- INSERT: user vota nele mesmo, em publicacao do condo dele
create policy publicacao_votos_insert on public.publicacao_votos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.publicacoes p
      where p.id = publicacao_id
        and p.ativo = true
        and p.condominio_id in (select public.user_condominios())
    )
  );

-- UPDATE: troca de opcao (apenas o proprio user)
create policy publicacao_votos_update on public.publicacao_votos
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy publicacao_votos_delete on public.publicacao_votos
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_onway());
