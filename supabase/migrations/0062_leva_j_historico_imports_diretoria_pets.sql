-- =============================================================
-- Leva J: Histórico consolidado (sem schema) +
-- Imports (batch_id) + Diretoria (mandatos) + Pets (vacina + circulacao)
-- =============================================================

-- -------------------------------------------------------------
-- 1) Imports: import_batch_id em registros importados em massa
-- -------------------------------------------------------------

alter table pessoas      add column if not exists import_batch_id uuid;
alter table unidades     add column if not exists import_batch_id uuid;
alter table veiculos     add column if not exists import_batch_id uuid;
alter table prestadores  add column if not exists import_batch_id uuid;

create index if not exists idx_pessoas_import_batch on pessoas (import_batch_id) where import_batch_id is not null;
create index if not exists idx_unidades_import_batch on unidades (import_batch_id) where import_batch_id is not null;
create index if not exists idx_veiculos_import_batch on veiculos (import_batch_id) where import_batch_id is not null;
create index if not exists idx_prestadores_import_batch on prestadores (import_batch_id) where import_batch_id is not null;

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('pessoas','unidades','veiculos','prestadores')),
  total_criados int not null default 0,
  desfeito_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batches_user_condo on import_batches (user_id, condominio_id, created_at desc);

alter table import_batches enable row level security;

drop policy if exists import_batches_select on import_batches;
create policy import_batches_select on import_batches for select
  using (
    user_id = auth.uid()
    or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
    or condominio_id in (
      select condominio_id from perfis
      where user_id = auth.uid() and role in ('administradora','sindico','subsindico')
    )
  );

drop policy if exists import_batches_insert on import_batches;
create policy import_batches_insert on import_batches for insert
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
      or condominio_id in (
        select condominio_id from perfis
        where user_id = auth.uid() and role in ('administradora','sindico','subsindico')
      )
    )
  );

drop policy if exists import_batches_update on import_batches;
create policy import_batches_update on import_batches for update
  using (
    user_id = auth.uid()
    and (
      exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
      or condominio_id in (
        select condominio_id from perfis
        where user_id = auth.uid() and role in ('administradora','sindico','subsindico')
      )
    )
  );

-- -------------------------------------------------------------
-- 2) Diretoria: mandatos
-- -------------------------------------------------------------

create table if not exists diretoria_mandatos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  perfil_id uuid not null references perfis(id) on delete cascade,
  cargo text not null check (cargo in ('sindico','subsindico','conselheiro','administradora')),
  data_inicio date not null default current_date,
  data_fim date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diretoria_mandatos_condo on diretoria_mandatos (condominio_id, ativo);
create index if not exists idx_diretoria_mandatos_perfil on diretoria_mandatos (perfil_id);
create index if not exists idx_diretoria_mandatos_vencendo
  on diretoria_mandatos (data_fim)
  where ativo = true and data_fim is not null;

alter table diretoria_mandatos enable row level security;

drop policy if exists diretoria_mandatos_select on diretoria_mandatos;
create policy diretoria_mandatos_select on diretoria_mandatos for select
  using (
    condominio_id in (select condominio_id from perfis where id = auth.uid())
    or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
  );

drop policy if exists diretoria_mandatos_write on diretoria_mandatos;
create policy diretoria_mandatos_write on diretoria_mandatos for all
  using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and (
          p.role = 'admin_onway'
          or (p.role in ('administradora','sindico','subsindico') and p.condominio_id = diretoria_mandatos.condominio_id)
        )
    )
  )
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and (
          p.role = 'admin_onway'
          or (p.role in ('administradora','sindico','subsindico') and p.condominio_id = diretoria_mandatos.condominio_id)
        )
    )
  );

-- -------------------------------------------------------------
-- 3) Pets: vacina + circulacao
-- -------------------------------------------------------------

alter table pets
  add column if not exists data_vacina_antirabica date,
  add column if not exists data_proximas_vacinas jsonb;   -- { antipulgas: '2026-08-01', v8: '2026-07-15', ... }

create index if not exists idx_pets_vacina_proxima
  on pets (data_vacina_antirabica)
  where ativo = true and data_vacina_antirabica is not null;

-- Tabela de circulacao (futuro: ronda registra passagem em areas comuns)
create table if not exists pet_circulacoes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  condominio_id uuid not null references condominios(id) on delete cascade,
  area text not null,                  -- 'piscina', 'parquinho', 'corredor', livre texto
  observado_em timestamptz not null default now(),
  observador_id uuid references auth.users(id) on delete set null,
  observacoes text
);

create index if not exists idx_pet_circulacoes_pet on pet_circulacoes (pet_id, observado_em desc);
create index if not exists idx_pet_circulacoes_condo on pet_circulacoes (condominio_id, observado_em desc);

alter table pet_circulacoes enable row level security;

drop policy if exists pet_circulacoes_select on pet_circulacoes;
create policy pet_circulacoes_select on pet_circulacoes for select
  using (
    condominio_id in (select condominio_id from perfis where id = auth.uid())
    or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
  );

drop policy if exists pet_circulacoes_insert on pet_circulacoes;
create policy pet_circulacoes_insert on pet_circulacoes for insert
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and (
          p.role = 'admin_onway'
          or (p.role in ('administradora','sindico','subsindico','portaria','ronda') and p.condominio_id = pet_circulacoes.condominio_id)
        )
    )
  );

-- -------------------------------------------------------------
-- 4) Pets: lembrete de vacina (idempotencia do cron)
-- -------------------------------------------------------------

create table if not exists pet_vacina_lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  tipo text not null check (tipo in ('antirabica_30d', 'antirabica_vencida')),
  enviado_em timestamptz not null default now(),
  enviado_data date not null default (current_date)
);

-- Idempotencia por dia: nao envia o mesmo tipo de lembrete duas vezes no mesmo dia
create unique index if not exists ux_pet_vacina_lembretes_dia
  on pet_vacina_lembretes_enviados (pet_id, tipo, enviado_data);

alter table pet_vacina_lembretes_enviados enable row level security;

drop policy if exists pet_vacina_lembretes_select on pet_vacina_lembretes_enviados;
create policy pet_vacina_lembretes_select on pet_vacina_lembretes_enviados for select
  using (
    exists (
      select 1 from pets pt
      where pt.id = pet_vacina_lembretes_enviados.pet_id
        and (
          pt.condominio_id in (select condominio_id from perfis where id = auth.uid())
          or exists (select 1 from perfis p where p.id = auth.uid() and p.role = 'admin_onway')
        )
    )
  );
