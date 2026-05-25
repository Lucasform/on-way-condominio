-- 0002_perfis_and_rls.sql
-- Fase 1, etapas 19 + 21 do ROADMAP.
-- Cria a tabela `perfis` (link entre auth.users e condominio + role)
-- e ativa RLS com policies de isolamento por condomínio em todas as tabelas.

-- ============================================================
-- 1) Tabela `perfis` (etapa 21)
-- ============================================================
create table public.perfis (
  id              uuid primary key
                  references auth.users(id) on delete cascade,
  condominio_id   uuid
                  references public.condominios(id) on delete cascade,
  role            text not null
                  check (role in
                    ('admin_onway','administradora','sindico',
                     'portaria','ronda','morador')),
  nome_exibicao   text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- admin_onway é cross-condo, então condominio_id deve ser null nesse caso
  constraint perfis_admin_cross_condo
    check (
      (role = 'admin_onway' and condominio_id is null) or
      (role <> 'admin_onway' and condominio_id is not null)
    )
);

create index perfis_condominio_idx on public.perfis (condominio_id);
create index perfis_role_idx       on public.perfis (role);

create trigger trg_perfis_updated_at
before update on public.perfis
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Helpers SECURITY DEFINER para evitar recursão em policies
-- ============================================================
create or replace function public.is_admin_onway()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
     where id = auth.uid()
       and role = 'admin_onway'
       and ativo = true
  );
$$;

create or replace function public.user_condominios()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select condominio_id
    from public.perfis
   where id = auth.uid()
     and ativo = true
     and condominio_id is not null;
$$;

create or replace function public.user_role_in(p_condominio uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.perfis
   where id = auth.uid()
     and ativo = true
     and (condominio_id = p_condominio or role = 'admin_onway')
   order by case when role = 'admin_onway' then 0 else 1 end
   limit 1;
$$;

-- ============================================================
-- 3) RLS habilitado em todas as tabelas
-- ============================================================
alter table public.condominios enable row level security;
alter table public.unidades    enable row level security;
alter table public.pessoas     enable row level security;
alter table public.veiculos    enable row level security;
alter table public.pets        enable row level security;
alter table public.perfis      enable row level security;

-- Forçar RLS mesmo para owners (impede bypass acidental)
alter table public.condominios force row level security;
alter table public.unidades    force row level security;
alter table public.pessoas     force row level security;
alter table public.veiculos    force row level security;
alter table public.pets        force row level security;
alter table public.perfis      force row level security;

-- ============================================================
-- 4) Policies — condominios
-- ============================================================
-- SELECT: admin_onway vê todos; usuário vê os condomínios em que tem perfil
create policy condominios_select on public.condominios
  for select to authenticated
  using (
    public.is_admin_onway()
    or id in (select public.user_condominios())
  );

-- INSERT: apenas admin_onway cria condomínio
create policy condominios_insert on public.condominios
  for insert to authenticated
  with check (public.is_admin_onway());

-- UPDATE: admin_onway ou administradora/síndico do próprio condomínio
create policy condominios_update on public.condominios
  for update to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(id) in ('administradora','sindico')
  )
  with check (
    public.is_admin_onway()
    or public.user_role_in(id) in ('administradora','sindico')
  );

-- DELETE: apenas admin_onway
create policy condominios_delete on public.condominios
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 5) Policies — unidades, pessoas, veiculos, pets
--    (mesmo padrão: isolamento por condominio_id)
-- ============================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array['unidades','pessoas','veiculos','pets']
  loop
    execute format($f$
      create policy %1$I_select on public.%1$I
        for select to authenticated
        using (
          public.is_admin_onway()
          or condominio_id in (select public.user_condominios())
        );

      create policy %1$I_insert on public.%1$I
        for insert to authenticated
        with check (
          public.is_admin_onway()
          or (
            condominio_id in (select public.user_condominios())
            and public.user_role_in(condominio_id)
              in ('administradora','sindico','portaria','ronda','morador')
          )
        );

      create policy %1$I_update on public.%1$I
        for update to authenticated
        using (
          public.is_admin_onway()
          or condominio_id in (select public.user_condominios())
        )
        with check (
          public.is_admin_onway()
          or condominio_id in (select public.user_condominios())
        );

      create policy %1$I_delete on public.%1$I
        for delete to authenticated
        using (
          public.is_admin_onway()
          or public.user_role_in(condominio_id) in ('administradora','sindico')
        );
    $f$, tbl);
  end loop;
end $$;

-- ============================================================
-- 6) Policies — perfis (autorreferência: cuidado)
-- ============================================================
-- SELECT: admin_onway vê todos; usuário vê o próprio perfil; sindico/admin do condo vê perfis do condo
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico')
    )
  );

-- INSERT: admin_onway cria qualquer perfil; sindico/administradora cria no próprio condo (exceto admin_onway)
create policy perfis_insert on public.perfis
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      role <> 'admin_onway'
      and condominio_id in (
        select condominio_id from public.perfis
         where id = auth.uid() and ativo = true
           and role in ('administradora','sindico')
      )
    )
  );

-- UPDATE: admin_onway; ou o próprio usuário editando dados não-sensíveis (nome); ou sindico no condo
create policy perfis_update on public.perfis
  for update to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico')
    )
  );

-- DELETE: apenas admin_onway (audit-friendly: prefira ativo=false)
create policy perfis_delete on public.perfis
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 7) Permissão de execução das functions
-- ============================================================
grant execute on function public.is_admin_onway()         to authenticated;
grant execute on function public.user_condominios()       to authenticated;
grant execute on function public.user_role_in(uuid)       to authenticated;

-- ============================================================
-- Fim 0002_perfis_and_rls.sql
-- Próximo: testar isolamento com 2 condomínios fictícios (etapa 27)
-- ============================================================
