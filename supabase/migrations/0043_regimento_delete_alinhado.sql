-- 0043_regimento_delete_alinhado.sql
-- Restringe DELETE em regimento_artigos a admin_onway + sindico.
-- Administradora segue podendo INSERT/UPDATE, mas nao apagar (alinha com o padrao
-- adotado nas demais tabelas: so admin geral e sindico fazem exclusao).

drop policy if exists regimento_delete on public.regimento_artigos;

create policy regimento_delete on public.regimento_artigos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) = 'sindico'
    )
  );
