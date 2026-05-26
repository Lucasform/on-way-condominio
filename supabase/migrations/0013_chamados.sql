-- 0013_chamados.sql
-- Fase 10, etapas 80 + 81 do ROADMAP.
-- Chamados de manutenção (morador abre, staff resolve).

-- ============================================================
-- 1) Tabela chamados
-- ============================================================
create table public.chamados (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null
                      references public.condominios(id) on delete cascade,
  unidade_id          uuid
                      references public.unidades(id) on delete set null,
  aberto_por          uuid not null
                      references auth.users(id) on delete set default
                      default '00000000-0000-0000-0000-000000000000'::uuid,
  titulo              text not null,
  descricao           text not null,
  categoria           text not null default 'outro'
                      check (categoria in
                        ('eletrica','hidraulica','jardim','limpeza',
                         'seguranca','elevador','estrutural','outro')),
  prioridade          text not null default 'media'
                      check (prioridade in ('baixa','media','alta','urgente')),
  status              text not null default 'aberto'
                      check (status in
                        ('aberto','em_andamento','aguardando','resolvido','cancelado')),
  foto_url            text,
  atribuido_para      uuid
                      references auth.users(id) on delete set null,
  resolvido_em        timestamptz,
  resolucao_nota      text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index chamados_condominio_idx       on public.chamados (condominio_id);
create index chamados_status_idx           on public.chamados (condominio_id, status, created_at desc);
create index chamados_aberto_por_idx       on public.chamados (aberto_por);
create index chamados_atribuido_idx        on public.chamados (atribuido_para) where atribuido_para is not null;

create trigger trg_chamados_updated_at
before update on public.chamados
for each row execute function public.set_updated_at();

create trigger trg_chamados_check_cond
before insert or update of unidade_id, condominio_id on public.chamados
for each row execute function public.check_unidade_condominio();

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public.chamados enable row level security;
alter table public.chamados force row level security;

-- SELECT:
--   admin_onway: tudo
--   staff (administradora, sindico, portaria, ronda): tudo do condomínio
--   morador: apenas os chamados que ele mesmo abriu
create policy chamados_select on public.chamados
  for select to authenticated
  using (
    public.is_admin_onway()
    or aberto_por = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
  );

-- INSERT: qualquer perfil ativo do condomínio pode abrir chamado
create policy chamados_insert on public.chamados
  for insert to authenticated
  with check (
    aberto_por = auth.uid()
    and (
      public.is_admin_onway()
      or condominio_id in (select public.user_condominios())
    )
  );

-- UPDATE: admin/staff podem mudar status/atribuir; autor pode editar título/descrição
-- enquanto status='aberto' (não implementamos verificação fina aqui — UI faz controle)
create policy chamados_update on public.chamados
  for update to authenticated
  using (
    public.is_admin_onway()
    or aberto_por = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or aberto_por = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- DELETE: apenas admin_onway (preserva histórico)
create policy chamados_delete on public.chamados
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 3) Trigger: novo chamado -> notifica staff
-- ============================================================
create or replace function public.tg_chamado_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fanout_app_notification(
    new.condominio_id,
    array['administradora','sindico'],
    'sistema',
    case new.prioridade
      when 'urgente' then '🚨 Chamado URGENTE'
      when 'alta'    then '🔴 Chamado prioridade alta'
      else 'Novo chamado de manutenção'
    end,
    left(new.titulo || ' — ' || new.descricao, 200),
    '/chamados/' || new.id::text
  );
  return new;
end;
$$;

create trigger trg_chamados_notify
after insert on public.chamados
for each row execute function public.tg_chamado_notify();

-- ============================================================
-- Fim 0013_chamados.sql
-- ============================================================
