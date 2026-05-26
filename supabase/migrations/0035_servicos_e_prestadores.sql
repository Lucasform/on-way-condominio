-- 0035: cadastro de prestadores e registro de serviços executados/em andamento
-- no condomínio (manutenção, limpeza, dedetização, etc).
-- Padrão de RLS: admin_onway + staff do condomínio operam; DELETE só admin_onway + sindico.

-- ============================================================
-- 1) Tabela `prestadores` — cadastro persistente
-- ============================================================
create table public.prestadores (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references public.condominios(id) on delete cascade,
  nome               text not null,
  categoria          text not null default 'outro'
                     check (categoria in
                       ('eletrica','hidraulica','jardim','limpeza',
                        'seguranca','elevador','estrutural','outro')),
  telefone           text,
  email              text,
  documento          text,                       -- CPF ou CNPJ
  valor_referencia   numeric(10, 2),             -- preço médio cobrado
  observacoes        text,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index prestadores_condo_idx     on public.prestadores (condominio_id);
create index prestadores_categoria_idx on public.prestadores (categoria);

create trigger trg_prestadores_updated_at
before update on public.prestadores
for each row execute function public.set_updated_at();

alter table public.prestadores enable row level security;

create policy prestadores_select on public.prestadores
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy prestadores_insert on public.prestadores
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

create policy prestadores_update on public.prestadores
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

create policy prestadores_delete on public.prestadores
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- ============================================================
-- 2) Tabela `servicos` — execução pontual
-- ============================================================
create table public.servicos (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references public.condominios(id) on delete cascade,
  prestador_id       uuid references public.prestadores(id) on delete set null,
  titulo             text not null,
  descricao          text,
  categoria          text not null default 'outro'
                     check (categoria in
                       ('eletrica','hidraulica','jardim','limpeza',
                        'seguranca','elevador','estrutural','outro')),
  status             text not null default 'agendado'
                     check (status in ('agendado','em_andamento','concluido','cancelado')),
  data_inicio        timestamptz,                  -- previsto ou efetivo
  data_fim           timestamptz,                  -- previsto ou efetivo
  valor              numeric(10, 2),
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index servicos_condo_idx    on public.servicos (condominio_id);
create index servicos_status_idx   on public.servicos (status);
create index servicos_prestador_idx on public.servicos (prestador_id);

create trigger trg_servicos_updated_at
before update on public.servicos
for each row execute function public.set_updated_at();

alter table public.servicos enable row level security;

create policy servicos_select on public.servicos
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy servicos_insert on public.servicos
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

create policy servicos_update on public.servicos
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

create policy servicos_delete on public.servicos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );
