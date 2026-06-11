-- 0094: permite staff/admin reprocessar manualmente itens da fila de envio
-- (botão "Reenviar" na tela). Escrita restrita a admin OnWay ou staff do condo.

create policy envio_fila_update on public.envio_fila
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora', 'sindico', 'subsindico')
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora', 'sindico', 'subsindico')
    )
  );
