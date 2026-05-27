-- 0049_mensagem_templates.sql
-- Templates reutilizaveis de mensagem (chat ou email) por condominio.
-- Sindico, subsindico, administradora e admin_onway cadastram; portaria,
-- ronda, conselheiro e morador podem usar (read-only).

create table public.mensagem_templates (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  tipo            text not null
                  check (tipo in ('chat','email')),
  titulo          text not null,
  corpo           text not null,
  assunto         text,            -- so email usa
  ativo           boolean not null default true,
  criado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index mensagem_templates_condo_idx
  on public.mensagem_templates (condominio_id, tipo, ativo);

create trigger trg_mensagem_templates_updated_at
before update on public.mensagem_templates
for each row execute function public.set_updated_at();

alter table public.mensagem_templates enable row level security;
alter table public.mensagem_templates force row level security;

-- SELECT: admin_onway + qualquer membro do condo
create policy mensagem_templates_select on public.mensagem_templates
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- INSERT/UPDATE: admin_onway + sindico/subsindico/administradora
create policy mensagem_templates_insert on public.mensagem_templates
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy mensagem_templates_update on public.mensagem_templates
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

-- DELETE: admin_onway + sindico
create policy mensagem_templates_delete on public.mensagem_templates
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) = 'sindico'
    )
  );
