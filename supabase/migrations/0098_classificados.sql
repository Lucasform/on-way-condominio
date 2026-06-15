-- 0098_classificados.sql
-- Classificados do condomínio: admin posta, moradores visualizam.
-- Estrutura pronta para integração futura com marketplaces externos.

-- ============================================================
-- Tabela principal
-- ============================================================
create table if not exists public.classificados (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references public.condominios(id) on delete cascade,
  criado_por      uuid references auth.users(id) on delete set null,

  titulo          text not null,
  descricao       text,
  categoria       text not null default 'outros',
  -- categoria: 'eletronicos' | 'moveis' | 'roupas' | 'servicos' | 'imoveis' | 'outros'

  preco           numeric(12,2),
  -- null = "a combinar"

  fotos           text[] default '{}',
  -- array de public URLs do storage (bucket classificados)

  status          text not null default 'ativo' check (status in ('ativo','vendido','cancelado')),

  -- campos reservados para integração futura (marketplace externo, link, etc.)
  link_externo    text,
  meta            jsonb default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists classificados_condominio_idx on public.classificados(condominio_id);
create index if not exists classificados_status_idx    on public.classificados(status);

comment on table public.classificados is
  'Classificados do condomínio. Admin posta, moradores visualizam. Pronto para integração futura com marketplace externo via link_externo e meta.';

-- updated_at automático
create or replace function public.set_classificados_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_classificados_updated_at on public.classificados;
create trigger trg_classificados_updated_at
  before update on public.classificados
  for each row execute procedure public.set_classificados_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.classificados enable row level security;

-- Moradores e staff do mesmo condo podem ler anúncios ativos
create policy classificados_select on public.classificados
  for select to authenticated
  using (
    condominio_id in (
      select condominio_id from public.perfis where id = auth.uid()
    )
    or
    exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway')
  );

-- Somente staff pode inserir
create policy classificados_insert on public.classificados
  for insert to authenticated
  with check (
    exists (
      select 1 from public.perfis
       where id = auth.uid()
         and condominio_id = classificados.condominio_id
         and role in ('sindico','subsindico','administradora','admin_onway')
    )
    or
    exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway')
  );

-- Staff pode atualizar/excluir seus próprios anúncios (ou admin_onway tudo)
create policy classificados_update on public.classificados
  for update to authenticated
  using (
    criado_por = auth.uid()
    or exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway')
  );

create policy classificados_delete on public.classificados
  for delete to authenticated
  using (
    criado_por = auth.uid()
    or exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway')
  );

-- ============================================================
-- Storage bucket (fotos dos classificados)
-- Criado via dashboard ou SQL abaixo (se extensão storage disponível)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('classificados', 'classificados', true)
-- on conflict do nothing;
