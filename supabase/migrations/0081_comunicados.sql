-- 0081_comunicados.sql
-- Comunicados gerais do condominio: aviso coletivo (manutencao, festa,
-- regra nova, etc). Gerados com ajuda da IA seguindo modelo padrao do condo
-- (anexo do tipo 'modelo_comunicado'). PDF padronizado igual multa/notificacao.

-- ============================================================
-- 1) Permitir tipo 'modelo_comunicado' em condominio_anexos
-- ============================================================
alter table public.condominio_anexos
  drop constraint if exists condominio_anexos_tipo_check;

alter table public.condominio_anexos
  add constraint condominio_anexos_tipo_check
  check (tipo in (
    'regimento',
    'modelo_notificacao',
    'modelo_multa',
    'modelo_comunicado',
    'outro'
  ));

-- ============================================================
-- 2) Tabela comunicados
-- ============================================================
create table public.comunicados (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  criado_por      uuid references auth.users(id) on delete set null,
  titulo          text not null,
  descricao       text not null,
                  -- input livre do gestor (o que ele quer comunicar)
  corpo           text not null,
                  -- texto polido final pelo agente IA (vai pro PDF e e-mail)
  modelo_anexo_id uuid references public.condominio_anexos(id) on delete set null,
                  -- snapshot do modelo usado quando gerou
  ia_modelo       text,
                  -- ex.: 'claude-haiku-4-5-20251001'
  status          text not null default 'rascunho'
                  check (status in ('rascunho','enviado','arquivado')),
  enviado_em      timestamptz,
  enviado_por_email boolean not null default false,
  destinatarios   integer not null default 0,
                  -- numero de moradores que receberam por e-mail
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index comunicados_condominio_idx
  on public.comunicados (condominio_id, status, created_at desc);

create trigger trg_comunicados_updated_at
before update on public.comunicados
for each row execute function public.set_updated_at();

-- ============================================================
-- 3) RLS
-- ============================================================
alter table public.comunicados enable row level security;
alter table public.comunicados force row level security;

-- SELECT: admin_onway, staff do condo, qualquer membro ve enviados
create policy comunicados_select on public.comunicados
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria','ronda','conselheiro'
        )
        or status = 'enviado'
      )
    )
  );

-- INSERT: admin + administradora/sindico
create policy comunicados_insert on public.comunicados
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- UPDATE: admin + administradora/sindico
create policy comunicados_update on public.comunicados
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- DELETE: admin + sindico
create policy comunicados_delete on public.comunicados
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );
