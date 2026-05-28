-- =============================================================
-- Leva H: Multas (timeline + vencimento) + Votações (quórum) +
-- Assembleias (presenças)
-- =============================================================

-- -------------------------------------------------------------
-- 1) Multas: vencimento + recibo de quitação opcional
-- -------------------------------------------------------------

alter table multas
  add column if not exists vencimento_em date,
  add column if not exists recibo_quitacao_url text;

create index if not exists idx_multas_vencimento_pending
  on multas (vencimento_em)
  where status = 'aplicada' and vencimento_em is not null;

-- -------------------------------------------------------------
-- 2) Multa status log (timeline)
--    Tabela append-only registra cada transicao de status.
-- -------------------------------------------------------------

create table if not exists multa_status_log (
  id uuid primary key default gen_random_uuid(),
  multa_id uuid not null references multas(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  ator_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_multa_status_log_multa on multa_status_log (multa_id, created_at);

alter table multa_status_log enable row level security;

drop policy if exists multa_status_log_select on multa_status_log;
create policy multa_status_log_select on multa_status_log for select
  using (
    exists (
      select 1 from multas m
      where m.id = multa_status_log.multa_id
        and (
          m.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
          or m.pessoa_id in (select id from pessoas where user_id = auth.uid())
        )
    )
  );

-- INSERT/UPDATE/DELETE so via service_role (trigger e edge functions).
-- Cliente nao escreve direto: e read-only pra UI.

-- Trigger: registra criacao e transicoes de status
create or replace function multa_status_log_record() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into multa_status_log (multa_id, status_anterior, status_novo, ator_id)
    values (new.id, null, new.status, new.aplicada_por);
  elsif (tg_op = 'UPDATE') then
    if old.status is distinct from new.status then
      insert into multa_status_log (multa_id, status_anterior, status_novo, ator_id)
      values (new.id, old.status, new.status, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_multa_status_log_insert on multas;
create trigger trg_multa_status_log_insert
  after insert on multas
  for each row execute function multa_status_log_record();

drop trigger if exists trg_multa_status_log_update on multas;
create trigger trg_multa_status_log_update
  after update of status on multas
  for each row execute function multa_status_log_record();

-- Backfill: cria um registro inicial pras multas que ja existem
insert into multa_status_log (multa_id, status_anterior, status_novo, ator_id, created_at)
select m.id, null, m.status, m.aplicada_por, m.created_at
from multas m
where not exists (select 1 from multa_status_log l where l.multa_id = m.id);

-- -------------------------------------------------------------
-- 3) Multa lembretes enviados (controle de idempotencia do cron)
-- -------------------------------------------------------------

create table if not exists multa_lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  multa_id uuid not null references multas(id) on delete cascade,
  tipo text not null check (tipo in ('vencimento_3d', 'vencimento_1d', 'vencido')),
  enviado_em timestamptz not null default now(),
  unique (multa_id, tipo)
);

create index if not exists idx_multa_lembretes_multa on multa_lembretes_enviados (multa_id);

alter table multa_lembretes_enviados enable row level security;

drop policy if exists multa_lembretes_select on multa_lembretes_enviados;
create policy multa_lembretes_select on multa_lembretes_enviados for select
  using (
    exists (
      select 1 from multas m
      where m.id = multa_lembretes_enviados.multa_id
        and (
          m.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
        )
    )
  );

-- -------------------------------------------------------------
-- 4) Votacoes: quorum minimo
-- -------------------------------------------------------------

alter table votacoes
  add column if not exists quorum_minimo int check (quorum_minimo is null or quorum_minimo >= 0);

-- -------------------------------------------------------------
-- 5) Assembleia presencas
-- -------------------------------------------------------------

create table if not exists assembleia_presencas (
  id uuid primary key default gen_random_uuid(),
  assembleia_id uuid not null references assembleias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmou_em timestamptz not null default now(),
  presente_em timestamptz,
  unique (assembleia_id, user_id)
);

create index if not exists idx_assembleia_presencas_assembleia
  on assembleia_presencas (assembleia_id);

alter table assembleia_presencas enable row level security;

-- SELECT: qualquer membro do condo da assembleia
drop policy if exists assembleia_presencas_select on assembleia_presencas;
create policy assembleia_presencas_select on assembleia_presencas for select
  using (
    exists (
      select 1 from assembleias a
      where a.id = assembleia_presencas.assembleia_id
        and (
          a.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
        )
    )
  );

-- INSERT: usuario confirmando a propria presenca, OU staff registrando pra alguem
drop policy if exists assembleia_presencas_insert on assembleia_presencas;
create policy assembleia_presencas_insert on assembleia_presencas for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from assembleias a
      join perfis p on p.condominio_id = a.condominio_id
      where a.id = assembleia_id
        and p.id = auth.uid()
        and p.role in ('admin_onway','administradora','sindico','subsindico')
    )
  );

-- UPDATE: staff marca presente_em
drop policy if exists assembleia_presencas_update on assembleia_presencas;
create policy assembleia_presencas_update on assembleia_presencas for update
  using (
    exists (
      select 1 from assembleias a
      join perfis p on p.condominio_id = a.condominio_id
      where a.id = assembleia_id
        and p.id = auth.uid()
        and p.role in ('admin_onway','administradora','sindico','subsindico')
    )
  );

-- DELETE: dono do voto pode retirar confirmacao, ou staff cancela
drop policy if exists assembleia_presencas_delete on assembleia_presencas;
create policy assembleia_presencas_delete on assembleia_presencas for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from assembleias a
      join perfis p on p.condominio_id = a.condominio_id
      where a.id = assembleia_id
        and p.id = auth.uid()
        and p.role in ('admin_onway','administradora','sindico','subsindico')
    )
  );

-- -------------------------------------------------------------
-- 6) Assembleia lembretes enviados (idempotencia do cron 24h)
-- -------------------------------------------------------------

create table if not exists assembleia_lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  assembleia_id uuid not null references assembleias(id) on delete cascade,
  tipo text not null check (tipo in ('24h')),
  enviado_em timestamptz not null default now(),
  unique (assembleia_id, tipo)
);

alter table assembleia_lembretes_enviados enable row level security;

drop policy if exists assembleia_lembretes_select on assembleia_lembretes_enviados;
create policy assembleia_lembretes_select on assembleia_lembretes_enviados for select
  using (
    exists (
      select 1 from assembleias a
      where a.id = assembleia_lembretes_enviados.assembleia_id
        and (
          a.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
        )
    )
  );

-- -------------------------------------------------------------
-- 7) Votacao eventos (controle de push aberta/encerrada)
-- -------------------------------------------------------------

create table if not exists votacao_eventos_enviados (
  id uuid primary key default gen_random_uuid(),
  votacao_id uuid not null references votacoes(id) on delete cascade,
  tipo text not null check (tipo in ('abertura', 'encerramento_24h', 'encerramento')),
  enviado_em timestamptz not null default now(),
  unique (votacao_id, tipo)
);

alter table votacao_eventos_enviados enable row level security;

drop policy if exists votacao_eventos_select on votacao_eventos_enviados;
create policy votacao_eventos_select on votacao_eventos_enviados for select
  using (
    exists (
      select 1 from votacoes v
      where v.id = votacao_eventos_enviados.votacao_id
        and (
          v.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
        )
    )
  );
