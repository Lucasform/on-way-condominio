-- 0046_perfis_rls_no_recursion.sql
-- Fix: 'infinite recursion detected in policy for relation perfis'.
--
-- As policies de SELECT/INSERT/UPDATE em perfis usavam subquery direta
-- `select ... from perfis where ...` que dispara recursao da propria
-- policy. Substituimos por uma function SECURITY DEFINER que faz a
-- consulta com search_path setado e bypassa RLS internamente.

create or replace function public.is_admin_condo(p_condo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
     where id = auth.uid()
       and ativo = true
       and condominio_id = p_condo
       and role in ('administradora','sindico','subsindico')
  );
$$;

grant execute on function public.is_admin_condo(uuid) to authenticated;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or (condominio_id is not null and public.is_admin_condo(condominio_id))
  );

drop policy if exists perfis_insert on public.perfis;
create policy perfis_insert on public.perfis
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      role <> 'admin_onway'
      and condominio_id is not null
      and public.is_admin_condo(condominio_id)
    )
  );

drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis
  for update to authenticated
  using (
    public.is_admin_onway()
    or id = auth.uid()
    or (condominio_id is not null and public.is_admin_condo(condominio_id))
  )
  with check (
    public.is_admin_onway()
    or id = auth.uid()
    or (condominio_id is not null and public.is_admin_condo(condominio_id))
  );
