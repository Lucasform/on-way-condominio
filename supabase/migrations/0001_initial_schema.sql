-- 0001_initial_schema.sql
-- Fase 1, etapas 17 + 18 do ROADMAP.
-- Cria as 5 tabelas base do OnWay Condomínio com condominio_id em todas (exceto a raiz).
-- Multi-tenant desde o dia 1. RLS é ativado em 0002.
-- Convenções: ver MODELO_DADOS.md.

-- ============================================================
-- Extensões
-- ============================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================
-- Função e trigger compartilhados de updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1) condominios — tabela raiz multi-tenant
-- ============================================================
create table public.condominios (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cnpj            text,
  endereco        text,
  bairro          text,
  cidade          text,
  estado          char(2),
  cep             text,
  administradora  text,
  plano           text not null default 'free'
                  check (plano in ('free','pro','enterprise')),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index condominios_cnpj_uidx
  on public.condominios (cnpj)
  where cnpj is not null;

create index condominios_ativo_idx
  on public.condominios (ativo);

create trigger trg_condominios_updated_at
before update on public.condominios
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) unidades
-- ============================================================
create table public.unidades (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  bloco           text,
  numero          text not null,
  tipo            text not null default 'apartamento'
                  check (tipo in ('apartamento','casa','sala','loja','outro')),
  area_m2         numeric(8,2),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index unidades_condominio_bloco_numero_uidx
  on public.unidades (condominio_id, coalesce(bloco,''), numero);

create index unidades_condominio_idx
  on public.unidades (condominio_id);

create trigger trg_unidades_updated_at
before update on public.unidades
for each row execute function public.set_updated_at();

-- ============================================================
-- 3) pessoas
-- ============================================================
create table public.pessoas (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null
                    references public.condominios(id) on delete cascade,
  unidade_id        uuid
                    references public.unidades(id) on delete set null,
  user_id           uuid
                    references auth.users(id) on delete set null,
  nome              text not null,
  cpf               text,
  email             text,
  telefone          text,
  data_nascimento   date,
  tipo_vinculo      text not null default 'morador'
                    check (tipo_vinculo in
                      ('titular','conjuge','filho','dependente',
                       'inquilino','funcionario','outro','morador')),
  relacao_unidade   text
                    check (relacao_unidade in
                      ('proprietario','inquilino','morador') or relacao_unidade is null),
  foto_url          text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index pessoas_condominio_cpf_uidx
  on public.pessoas (condominio_id, cpf)
  where cpf is not null;

create index pessoas_condominio_idx on public.pessoas (condominio_id);
create index pessoas_unidade_idx    on public.pessoas (unidade_id);
create index pessoas_user_idx       on public.pessoas (user_id) where user_id is not null;

create trigger trg_pessoas_updated_at
before update on public.pessoas
for each row execute function public.set_updated_at();

-- ============================================================
-- 4) veiculos
-- ============================================================
create table public.veiculos (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  unidade_id      uuid not null
                  references public.unidades(id) on delete cascade,
  pessoa_id       uuid
                  references public.pessoas(id) on delete set null,
  placa           text not null,
  modelo          text,
  cor             text,
  tipo            text not null default 'carro'
                  check (tipo in ('carro','moto','bicicleta','utilitario','outro')),
  vaga            text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index veiculos_condominio_placa_uidx
  on public.veiculos (condominio_id, upper(placa));

create index veiculos_unidade_idx on public.veiculos (unidade_id);

create trigger trg_veiculos_updated_at
before update on public.veiculos
for each row execute function public.set_updated_at();

-- ============================================================
-- 5) pets
-- ============================================================
create table public.pets (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null
                      references public.condominios(id) on delete cascade,
  unidade_id          uuid not null
                      references public.unidades(id) on delete cascade,
  pessoa_id           uuid
                      references public.pessoas(id) on delete set null,
  nome                text not null,
  especie             text not null default 'cao'
                      check (especie in ('cao','gato','ave','outro')),
  raca                text,
  porte               text
                      check (porte in ('pequeno','medio','grande') or porte is null),
  foto_url            text,
  vacinacao_em_dia    boolean not null default false,
  observacoes         text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index pets_condominio_idx on public.pets (condominio_id);
create index pets_unidade_idx    on public.pets (unidade_id);

create trigger trg_pets_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

-- ============================================================
-- Trigger de consistência: condominio_id de filhas bate com unidade
-- ============================================================
create or replace function public.check_unidade_condominio()
returns trigger
language plpgsql
as $$
declare
  v_cond uuid;
begin
  if new.unidade_id is not null then
    select condominio_id into v_cond from public.unidades where id = new.unidade_id;
    if v_cond is null then
      raise exception 'unidade % nao encontrada', new.unidade_id;
    end if;
    if v_cond <> new.condominio_id then
      raise exception 'condominio_id (%) nao bate com a unidade.condominio_id (%)',
        new.condominio_id, v_cond;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_pessoas_check_cond
before insert or update of unidade_id, condominio_id on public.pessoas
for each row execute function public.check_unidade_condominio();

create trigger trg_veiculos_check_cond
before insert or update of unidade_id, condominio_id on public.veiculos
for each row execute function public.check_unidade_condominio();

create trigger trg_pets_check_cond
before insert or update of unidade_id, condominio_id on public.pets
for each row execute function public.check_unidade_condominio();

-- ============================================================
-- Fim 0001_initial_schema.sql
-- RLS será ativado em 0002_rls_enable.sql junto com a tabela `perfis` (etapa 21)
-- ============================================================
