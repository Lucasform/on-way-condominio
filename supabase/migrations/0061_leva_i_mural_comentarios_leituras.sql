-- =============================================================
-- Leva I: Mural (comentarios + leituras) + Templates (vars) + Auditoria (retencao)
-- =============================================================

-- -------------------------------------------------------------
-- 1) Mural: comentarios em publicacoes
-- -------------------------------------------------------------

create table if not exists comentarios_publicacao (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references publicacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conteudo text not null check (length(trim(conteudo)) > 0 and length(conteudo) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_comentarios_publicacao_pub
  on comentarios_publicacao (publicacao_id, created_at);

alter table comentarios_publicacao enable row level security;

-- SELECT: membros do condo da publicacao
drop policy if exists comentarios_publicacao_select on comentarios_publicacao;
create policy comentarios_publicacao_select on comentarios_publicacao for select
  using (
    exists (
      select 1 from publicacoes p
      where p.id = comentarios_publicacao.publicacao_id
        and (
          p.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis pf where pf.id = auth.uid() and pf.role = 'admin_onway')
        )
    )
  );

-- INSERT: o proprio user, dentro do condo da publicacao
drop policy if exists comentarios_publicacao_insert on comentarios_publicacao;
create policy comentarios_publicacao_insert on comentarios_publicacao for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from publicacoes p
      where p.id = publicacao_id
        and p.ativo = true
        and (
          p.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis pf where pf.id = auth.uid() and pf.role = 'admin_onway')
        )
    )
  );

-- DELETE: dono do comentario OU staff
drop policy if exists comentarios_publicacao_delete on comentarios_publicacao;
create policy comentarios_publicacao_delete on comentarios_publicacao for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from publicacoes p
      join perfis pf on pf.condominio_id = p.condominio_id
      where p.id = publicacao_id
        and pf.id = auth.uid()
        and pf.role in ('admin_onway','administradora','sindico','subsindico')
    )
  );

-- -------------------------------------------------------------
-- 2) Mural: leituras (lido por morador)
-- -------------------------------------------------------------

create table if not exists publicacao_leituras (
  publicacao_id uuid not null references publicacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (publicacao_id, user_id)
);

create index if not exists idx_publicacao_leituras_user
  on publicacao_leituras (user_id, lida_em desc);

alter table publicacao_leituras enable row level security;

-- SELECT: so o proprio user ve suas leituras
drop policy if exists publicacao_leituras_select on publicacao_leituras;
create policy publicacao_leituras_select on publicacao_leituras for select
  using (user_id = auth.uid());

-- INSERT/UPDATE: o proprio user
drop policy if exists publicacao_leituras_insert on publicacao_leituras;
create policy publicacao_leituras_insert on publicacao_leituras for insert
  with check (user_id = auth.uid());

drop policy if exists publicacao_leituras_update on publicacao_leituras;
create policy publicacao_leituras_update on publicacao_leituras for update
  using (user_id = auth.uid());

drop policy if exists publicacao_leituras_delete on publicacao_leituras;
create policy publicacao_leituras_delete on publicacao_leituras for delete
  using (user_id = auth.uid());

-- -------------------------------------------------------------
-- 3) Auditoria: funcao de retencao (apaga > 12 meses)
-- -------------------------------------------------------------

create or replace function audit_log_aplicar_retencao(meses int default 12) returns int
language plpgsql security definer set search_path = public
as $$
declare
  deletados int;
begin
  delete from audit_log
  where created_at < now() - (meses || ' months')::interval;
  get diagnostics deletados = row_count;
  return deletados;
end;
$$;

comment on function audit_log_aplicar_retencao(int) is
  'Apaga entradas de audit_log mais antigas que N meses (default 12). Chamar via edge cron-auditoria-retencao.';
