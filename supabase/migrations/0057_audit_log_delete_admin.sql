-- 0057_audit_log_delete_admin.sql
-- Adiciona DELETE em audit_log so pra admin_onway.
-- E volta emails_delete a aceitar admin_onway + sindico (a 0056
-- tinha restringido demais a pedido inicial; ajuste subsequente).

drop policy if exists audit_log_delete on public.audit_log;
create policy audit_log_delete on public.audit_log
  for delete to authenticated
  using (public.is_admin_onway());

drop policy if exists emails_delete on public.emails;
create policy emails_delete on public.emails
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (condominio_id is not null and public.user_role_in(condominio_id) = 'sindico')
  );
