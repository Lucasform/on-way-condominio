-- 0005_multas.sql
-- Fase 2, etapa 32 do ROADMAP.
-- Cria a tabela `multas` (decisão de multa: valor + status; sem transação financeira).
-- Conforme CLAUDE.md: "Multa registra apenas a decisão, nunca uma transação".
-- UI de geração e fluxo de status virá nas etapas 33-34.

-- ============================================================
-- 1) Tabela multas
-- ============================================================
create table public.multas (
  id                    uuid primary key default gen_random_uuid(),
  condominio_id         uuid not null
                        references public.condominios(id) on delete cascade,
  unidade_id            uuid not null
                        references public.unidades(id) on delete restrict,
  pessoa_id             uuid
                        references public.pessoas(id) on delete set null,
  ocorrencia_id         uuid
                        references public.ocorrencias(id) on delete set null,
  aplicada_por          uuid not null
                        references auth.users(id) on delete set default
                        default '00000000-0000-0000-0000-000000000000'::uuid,
  valor                 numeric(10,2) not null
                        check (valor >= 0),
  artigo_regimento      text,
  descricao             text not null,
  status                text not null default 'em_analise'
                        check (status in
                          ('em_analise','aplicada','paga',
                           'contestada','cancelada','arquivada')),
  data_aplicacao        date,
  data_pagamento        date,
  observacoes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Coerência: se status=paga, data_pagamento não pode ser null
  constraint multa_paga_tem_data
    check (status <> 'paga' or data_pagamento is not null),
  -- Coerência: se status=aplicada/paga, data_aplicacao não pode ser null
  constraint multa_aplicada_tem_data
    check (status not in ('aplicada','paga') or data_aplicacao is not null)
);

create index multas_condominio_idx     on public.multas (condominio_id);
create index multas_unidade_idx        on public.multas (unidade_id);
create index multas_pessoa_idx         on public.multas (pessoa_id);
create index multas_ocorrencia_idx     on public.multas (ocorrencia_id);
create index multas_status_idx         on public.multas (status);
create index multas_aplicada_por_idx   on public.multas (aplicada_por);
create index multas_created_at_idx     on public.multas (created_at desc);

create trigger trg_multas_updated_at
before update on public.multas
for each row execute function public.set_updated_at();

-- Reusa o trigger de consistência condominio_id × unidade_id
create trigger trg_multas_check_cond
before insert or update of unidade_id, condominio_id on public.multas
for each row execute function public.check_unidade_condominio();

-- ============================================================
-- 2) RLS em multas
-- ============================================================
alter table public.multas enable row level security;
alter table public.multas force row level security;

-- SELECT:
--   admin_onway: vê todas
--   administradora, sindico, portaria, ronda: veem todas do próprio condomínio
--   morador: vê apenas as multas que vinculam à sua pessoa
--            (pessoa.user_id = auth.uid())
create policy multas_select on public.multas
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
    or pessoa_id in (
      select id from public.pessoas where user_id = auth.uid()
    )
  );

-- INSERT: admin_onway + administradora/sindico do condomínio
create policy multas_insert on public.multas
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- UPDATE: admin_onway + administradora/sindico do condomínio
-- (morador não atualiza — contestação é via chat/etapa futura)
create policy multas_update on public.multas
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

-- DELETE: apenas admin_onway (preserva histórico)
create policy multas_delete on public.multas
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- Fim 0005_multas.sql
-- Próximas etapas: 33 (geração manual), 34 (status + histórico por unidade)
-- ============================================================
