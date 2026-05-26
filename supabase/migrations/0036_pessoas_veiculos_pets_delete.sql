-- 0036: alinha DELETE de pessoas/veiculos/pets com o padrão geral
-- "exclusivamente admin_onway + sindico". Hoje a policy generica do 0002
-- (e a especifica de 0003 pra pessoas) permite administradora tambem.
-- Mantemos consistencia com o restante das entidades operacionais.

drop policy if exists pessoas_delete on public.pessoas;
create policy pessoas_delete on public.pessoas
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

drop policy if exists veiculos_delete on public.veiculos;
create policy veiculos_delete on public.veiculos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

drop policy if exists pets_delete on public.pets;
create policy pets_delete on public.pets
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );
