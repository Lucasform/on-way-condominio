-- 0003_refine_pessoas_rls.sql
-- Refina as policies de `pessoas`: morador só pode ver/editar o PRÓPRIO cadastro;
-- só admin_onway, administradora e síndico podem criar/atualizar pessoas em geral.
-- Versão anterior (0002) deixava qualquer morador do condomínio editar qualquer pessoa.

-- ============================================================
-- 1) Drop policies existentes em pessoas
-- ============================================================
drop policy if exists pessoas_select on public.pessoas;
drop policy if exists pessoas_insert on public.pessoas;
drop policy if exists pessoas_update on public.pessoas;
drop policy if exists pessoas_delete on public.pessoas;

-- ============================================================
-- 2) Novas policies — princípio de menor privilégio
-- ============================================================

-- SELECT:
--   admin_onway: vê todos
--   administradora, sindico, portaria, ronda: veem todas as pessoas do próprio condomínio
--   morador: vê apenas o próprio cadastro (pessoa.user_id = auth.uid())
create policy pessoas_select on public.pessoas
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
    or user_id = auth.uid()
  );

-- INSERT: apenas admin_onway, administradora e síndico podem cadastrar nova pessoa
create policy pessoas_insert on public.pessoas
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- UPDATE:
--   admin_onway: pode atualizar qualquer pessoa
--   administradora/sindico: podem atualizar qualquer pessoa do próprio condomínio
--   morador: pode atualizar APENAS o próprio cadastro (pessoa.user_id = auth.uid())
create policy pessoas_update on public.pessoas
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
    or user_id = auth.uid()
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
    or user_id = auth.uid()
  );

-- DELETE: admin_onway + administradora/sindico do próprio condomínio
create policy pessoas_delete on public.pessoas
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );
