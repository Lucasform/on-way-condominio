-- 0056_emails_delete_so_admin.sql
-- Restringe DELETE em emails apenas ao admin_onway (admin geral).
-- A 0032 tinha liberado pra sindico tambem, mas o controle de log
-- deve ser exclusivo do operador da plataforma.

drop policy if exists emails_delete on public.emails;
create policy emails_delete on public.emails
  for delete to authenticated
  using (public.is_admin_onway());
