-- 0083_user_id_by_email.sql
-- Helper RPC pra admin_onway resolver user_id a partir de e-mail.
-- Usado pelo painel VincularUserAoCondo: admin OnWay digita e-mail,
-- recebe o id de auth.users pra inserir em perfis_condominios.
--
-- Restrita a admin_onway (security definer) pra nao expor enumeracao
-- de e-mails pra usuarios comuns.

create or replace function public.user_id_by_email(p_email text)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
    and public.is_admin_onway()
  limit 1;
$$;

grant execute on function public.user_id_by_email(text) to authenticated;
