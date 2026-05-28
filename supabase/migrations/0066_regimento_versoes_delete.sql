-- Permite apagar snapshot do regimento — admin geral + sindico/subsindico.
drop policy if exists regimento_versoes_delete on regimento_versoes;
create policy regimento_versoes_delete on regimento_versoes for delete
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) = 'sindico'
    )
  );
