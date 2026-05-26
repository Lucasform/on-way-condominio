-- 0026_fix_admin_assume.sql
-- Fix: trigger de sync não deve criar linha em perfis_condominios pra admin_onway

create or replace function public.sync_perfis_condominios()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Admin_onway nunca entra em perfis_condominios (não é staff de condomínio específico)
  if NEW.role = 'admin_onway' then
    return NEW;
  end if;
  if NEW.condominio_id is not null then
    insert into public.perfis_condominios (perfil_id, condominio_id, role, ativo)
    values (NEW.id, NEW.condominio_id, NEW.role, NEW.ativo)
    on conflict (perfil_id, condominio_id) do update
      set role = excluded.role,
          ativo = excluded.ativo;
  end if;
  return NEW;
end $$;
