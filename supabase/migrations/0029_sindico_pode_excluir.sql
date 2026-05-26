-- 0029: síndico passa a poder excluir multa e notificação (além do admin_onway).
-- Frontend pede confirmação explícita; aqui só relaxa o RLS.

drop policy if exists multas_delete on public.multas;
create policy multas_delete on public.multas
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

drop policy if exists notificacoes_delete on public.notificacoes;
create policy notificacoes_delete on public.notificacoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );
