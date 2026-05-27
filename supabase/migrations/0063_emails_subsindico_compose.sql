-- 0058_emails_subsindico_compose.sql
-- FASE 15 / Leva A — compose manual de e-mail.
-- Permite subsindico ver/apagar e-mails do condomínio (igual síndico).

drop policy if exists emails_select on public.emails;
create policy emails_select on public.emails
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','subsindico')
    )
  );

drop policy if exists emails_delete on public.emails;
create policy emails_delete on public.emails
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('sindico','subsindico')
    )
  );
