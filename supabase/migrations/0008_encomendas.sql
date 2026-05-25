-- 0008_encomendas.sql
-- Fase 5, etapa 56 do ROADMAP.
-- Cria a tabela `encomendas` (registros da portaria: pacotes, comida, documentos).
-- Inclui RLS isolada por condomínio + visibilidade para o morador destinatário.

-- ============================================================
-- 1) Tabela encomendas
-- ============================================================
create table public.encomendas (
  id                      uuid primary key default gen_random_uuid(),
  condominio_id           uuid not null
                          references public.condominios(id) on delete cascade,
  unidade_id              uuid not null
                          references public.unidades(id) on delete restrict,
  pessoa_id               uuid
                          references public.pessoas(id) on delete set null,

  tipo                    text not null default 'encomenda'
                          check (tipo in ('encomenda','comida','documento','outro')),
  transportadora          text,
  codigo_rastreio         text,
  descricao               text,
  local_armazenamento     text,
  foto_url                text,
  observacoes             text,

  recebido_por            uuid not null
                          references auth.users(id) on delete set default
                          default '00000000-0000-0000-0000-000000000000'::uuid,
  entregue_em             timestamptz,
  entregue_para           text,
  entregue_por            uuid
                          references auth.users(id) on delete set null,

  status                  text not null default 'aguardando'
                          check (status in ('aguardando','entregue','devolvida')),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Coerência: status=entregue requer entregue_em + entregue_por
  constraint encomenda_entregue_tem_data
    check (status <> 'entregue' or (entregue_em is not null and entregue_por is not null))
);

create index encomendas_condominio_idx       on public.encomendas (condominio_id);
create index encomendas_unidade_idx          on public.encomendas (unidade_id);
create index encomendas_pessoa_idx           on public.encomendas (pessoa_id);
create index encomendas_status_idx           on public.encomendas (status);
create index encomendas_created_at_idx       on public.encomendas (created_at desc);
create index encomendas_condominio_status_idx on public.encomendas (condominio_id, status);

create trigger trg_encomendas_updated_at
before update on public.encomendas
for each row execute function public.set_updated_at();

-- Reusa a checagem de coerência condominio_id × unidade_id
create trigger trg_encomendas_check_cond
before insert or update of unidade_id, condominio_id on public.encomendas
for each row execute function public.check_unidade_condominio();

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public.encomendas enable row level security;
alter table public.encomendas force row level security;

-- SELECT:
--   admin_onway: tudo
--   administradora/sindico/portaria/ronda: tudo do próprio condomínio
--   morador: vê encomendas DA própria pessoa OU DA própria unidade
create policy encomendas_select on public.encomendas
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
    or pessoa_id in (select id from public.pessoas where user_id = auth.uid())
    or unidade_id in (
      select unidade_id from public.pessoas
       where user_id = auth.uid() and unidade_id is not null
    )
  );

-- INSERT: portaria, sindico, administradora, admin
create policy encomendas_insert on public.encomendas
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

-- UPDATE: mesmo conjunto pode dar baixa / corrigir
create policy encomendas_update on public.encomendas
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

-- DELETE: apenas admin_onway
create policy encomendas_delete on public.encomendas
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- Fim 0008_encomendas.sql
-- Próximas etapas (57-62): UI portaria, lista, dar baixa, histórico.
-- Aviso por e-mail ao morador (etapa 61) fica para Fase 4.
-- ============================================================
