-- 0010_eventos.sql
-- Fase 7, etapa 67 do ROADMAP.
-- Eventos do calendário do condomínio (assembleias, manutenções, etc.)

-- ============================================================
-- 1) Tabela eventos
-- ============================================================
create table public.eventos (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  criado_por      uuid not null
                  references auth.users(id) on delete set default
                  default '00000000-0000-0000-0000-000000000000'::uuid,
  titulo          text not null,
  descricao       text,
  data_inicio     timestamptz not null,
  data_fim        timestamptz,
  local           text,
  tipo            text not null default 'evento'
                  check (tipo in ('assembleia','manutencao','evento','reuniao','outro')),
  publico         boolean not null default true,  -- false = só staff
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evento_periodo_valido
    check (data_fim is null or data_fim >= data_inicio)
);

create index eventos_condominio_idx on public.eventos (condominio_id);
create index eventos_data_inicio_idx on public.eventos (condominio_id, data_inicio);
create index eventos_ativo_idx on public.eventos (condominio_id, ativo);

create trigger trg_eventos_updated_at
before update on public.eventos
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public.eventos enable row level security;
alter table public.eventos force row level security;

-- SELECT:
--   admin_onway: tudo
--   eventos publicos: qualquer perfil do condomínio
--   eventos não-publicos (staff): só admin/administradora/sindico/portaria/ronda
create policy eventos_select on public.eventos
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        publico = true
        or public.user_role_in(condominio_id)
            in ('administradora','sindico','portaria','ronda')
      )
    )
  );

-- INSERT/UPDATE/DELETE: admin/administradora/sindico
create policy eventos_insert on public.eventos
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy eventos_update on public.eventos
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

create policy eventos_delete on public.eventos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- Fim 0010_eventos.sql
-- ============================================================
