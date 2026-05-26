-- 0032: admin_onway e síndico podem excluir registros das entidades operacionais.
-- Frontend pede confirmação. Aqui apenas relaxamos o RLS pra liberar o DELETE.
-- "Exclusivamente esses dois perfis" — administradora NÃO inclusa.

-- ---------- helper inline pra readability ----------
-- usa public.user_role_in(condominio_id) = 'sindico' OR public.is_admin_onway()

-- ============================================================
-- Ocorrências (antes: apenas admin_onway)
-- ============================================================
drop policy if exists ocorrencias_delete on public.ocorrencias;
create policy ocorrencias_delete on public.ocorrencias
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Chamados (antes: apenas admin_onway)
-- ============================================================
drop policy if exists chamados_delete on public.chamados;
create policy chamados_delete on public.chamados
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Encomendas (antes: apenas admin_onway)
-- ============================================================
drop policy if exists encomendas_delete on public.encomendas;
create policy encomendas_delete on public.encomendas
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Votações (antes: admin_onway + administradora/sindico)
-- Alinha pra admin_onway + sindico apenas.
-- ============================================================
drop policy if exists votacoes_delete on public.votacoes;
create policy votacoes_delete on public.votacoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Publicações do mural (antes: admin_onway + administradora/sindico)
-- ============================================================
drop policy if exists publicacoes_delete on public.publicacoes;
create policy publicacoes_delete on public.publicacoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Eventos do calendário (antes: admin_onway + administradora/sindico)
-- ============================================================
drop policy if exists eventos_delete on public.eventos;
create policy eventos_delete on public.eventos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- E-mails log (antes: só admin_onway)
-- ============================================================
drop policy if exists emails_delete on public.emails;
create policy emails_delete on public.emails
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Conversas de chat (antes: só admin)
-- ============================================================
drop policy if exists conversas_delete on public.conversas;
create policy conversas_delete on public.conversas
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Audit log — antes: nenhuma policy DELETE (bloqueado pra authenticated).
-- Liberar admin_onway + sindico. NOTA: síndico apagar entradas próprias
-- do log é um risco conhecido — registramos aqui pra ficar claro.
-- ============================================================
drop policy if exists audit_log_delete on public.audit_log;
create policy audit_log_delete on public.audit_log
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- Condomínios: continua APENAS admin_onway. Síndico não apaga o próprio
-- prédio do SaaS. (sem alteração — comentado pra documentação)
-- ============================================================
-- create policy condominios_delete já existe em 0002, restrito a admin_onway.
