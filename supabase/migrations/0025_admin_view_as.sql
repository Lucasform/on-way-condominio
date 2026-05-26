-- 0025_admin_view_as.sql
-- Permite admin_onway "assumir" um condomínio temporariamente.

alter table public.perfis drop constraint if exists perfis_admin_cross_condo;

create or replace function public.exit_view_as()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin_onway() then
    raise exception 'Apenas admin_onway pode sair do modo view-as.' using errcode = 'P0001';
  end if;
  update public.perfis set condominio_id = null where id = auth.uid();
end $$;

grant execute on function public.exit_view_as() to authenticated;
