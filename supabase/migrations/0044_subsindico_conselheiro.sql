-- 0044_subsindico_conselheiro.sql
-- Roles novas: 'subsindico' (mesmos poderes do sindico) e 'conselheiro' (read-only).
--
-- Truque pra evitar refactor de RLS em 26 migrations:
--   user_role_in() retorna 'sindico' quando o usuario e 'subsindico'.
--   Assim TODAS as policies que checam 'sindico' aceitam subsindico
--   automaticamente, sem mudar uma linha de RLS existente.
--
-- Conselheiro: nao precisa de policy nova. Herda o SELECT das policies
-- existentes "any condo member", mas nao consegue INSERT/UPDATE/DELETE
-- porque nao esta listado em nenhuma policy de mutacao.

-- ============================================================
-- 1) Atualiza check constraint do perfis.role
-- ============================================================
alter table public.perfis drop constraint if exists perfis_role_check;
alter table public.perfis
  add constraint perfis_role_check
  check (role in (
    'admin_onway','administradora','sindico','subsindico',
    'conselheiro','portaria','ronda','morador'
  ));

-- Reaplica constraint admin cross-condo (PG manteve mas pra garantir)
alter table public.perfis drop constraint if exists perfis_admin_cross_condo;
alter table public.perfis
  add constraint perfis_admin_cross_condo
  check (
    (role = 'admin_onway' and condominio_id is null) or
    (role <> 'admin_onway' and condominio_id is not null)
  );

-- ============================================================
-- 2) user_role_in: subsindico se comporta como sindico em RLS
-- ============================================================
create or replace function public.user_role_in(p_condominio uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when role = 'subsindico' then 'sindico'
           else role
         end
    from public.perfis
   where id = auth.uid()
     and ativo = true
     and (condominio_id = p_condominio or role = 'admin_onway')
   order by case when role = 'admin_onway' then 0 else 1 end
   limit 1;
$$;

-- ============================================================
-- 3) Helper: descobrir o role REAL (sem aliasing) pra UI/admin
-- ============================================================
create or replace function public.user_role_real(p_condominio uuid)
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

grant execute on function public.user_role_real(uuid) to authenticated;

-- ============================================================
-- 4) Policies de perfis: inclui subsindico nas listas
-- ============================================================
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico','subsindico')
    )
  );

drop policy if exists perfis_insert on public.perfis;
create policy perfis_insert on public.perfis
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      role <> 'admin_onway'
      and condominio_id in (
        select condominio_id from public.perfis
         where id = auth.uid() and ativo = true
           and role in ('administradora','sindico','subsindico')
      )
    )
  );

drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis
  for update to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico','subsindico')
    )
  )
  with check (
    public.is_admin_onway()
    or id = auth.uid()
    or condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid() and ativo = true
         and role in ('administradora','sindico','subsindico')
    )
  );

-- ============================================================
-- 5) Unicidade: 1 sindico ativo por condominio
-- ============================================================
create unique index if not exists perfis_unico_sindico_por_condo
  on public.perfis (condominio_id)
  where role = 'sindico' and ativo = true;
