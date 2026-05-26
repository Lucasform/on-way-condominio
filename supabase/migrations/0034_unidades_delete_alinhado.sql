-- 0034: alinha DELETE de unidades com o padrão "exclusivamente admin_onway + sindico".
-- A policy genérica criada em 0002 permite tambem administradora — aqui sobrescrevemos
-- pra remover administradora desse caminho, mantendo o padrao das demais entidades operacionais.

drop policy if exists unidades_delete on public.unidades;
create policy unidades_delete on public.unidades
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );
