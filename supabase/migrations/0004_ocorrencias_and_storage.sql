-- 0004_ocorrencias_and_storage.sql
-- Fase 2, etapa 28 do ROADMAP.
-- Cria a tabela `ocorrencias` (registros de incidentes/relatos no condomínio)
-- e o bucket de Storage `ocorrencia-fotos` com policies de RLS isoladas por condomínio.
-- UI (formulário, lista, detalhe) virão nas etapas 29-31.

-- ============================================================
-- 1) Tabela ocorrencias
-- ============================================================
create table public.ocorrencias (
  id                    uuid primary key default gen_random_uuid(),
  condominio_id         uuid not null
                        references public.condominios(id) on delete cascade,
  unidade_id            uuid
                        references public.unidades(id) on delete set null,
  pessoa_envolvida_id   uuid
                        references public.pessoas(id) on delete set null,
  reportado_por         uuid not null
                        references auth.users(id) on delete set default
                        default '00000000-0000-0000-0000-000000000000'::uuid,
  -- Quem reportou — default 0000... cobre o caso de DELETE do usuário (preserva histórico)
  local                 text,
  descricao             text not null,
  foto_url              text,
  status                text not null default 'aberta'
                        check (status in
                          ('aberta','em_analise','arquivada','virou_multa','cancelada')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index ocorrencias_condominio_idx on public.ocorrencias (condominio_id);
create index ocorrencias_unidade_idx    on public.ocorrencias (unidade_id);
create index ocorrencias_status_idx     on public.ocorrencias (status);
create index ocorrencias_reportado_por_idx on public.ocorrencias (reportado_por);
create index ocorrencias_created_at_idx on public.ocorrencias (created_at desc);

create trigger trg_ocorrencias_updated_at
before update on public.ocorrencias
for each row execute function public.set_updated_at();

-- Reusa o trigger de consistência condominio_id × unidade_id
create trigger trg_ocorrencias_check_cond
before insert or update of unidade_id, condominio_id on public.ocorrencias
for each row execute function public.check_unidade_condominio();

-- ============================================================
-- 2) RLS em ocorrencias
-- ============================================================
alter table public.ocorrencias enable row level security;
alter table public.ocorrencias force row level security;

-- SELECT:
--   admin_onway: vê todas
--   administradora, sindico, portaria, ronda: veem todas do próprio condomínio
--   morador: vê as que reportou + as ligadas à própria pessoa (pessoa_envolvida_id)
create policy ocorrencias_select on public.ocorrencias
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
    or reportado_por = auth.uid()
    or pessoa_envolvida_id in (
      select id from public.pessoas where user_id = auth.uid()
    )
  );

-- INSERT: qualquer usuário autenticado em um condomínio pode registrar ocorrência
-- (essa é a regra de negócio — portaria, ronda, morador e síndico todos reportam)
create policy ocorrencias_insert on public.ocorrencias
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- UPDATE: admin_onway + administradora/sindico do próprio condomínio
-- (morador NÃO pode editar ocorrência depois de criada — é registro)
create policy ocorrencias_update on public.ocorrencias
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
create policy ocorrencias_delete on public.ocorrencias
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 3) Storage bucket para fotos de ocorrência
-- ============================================================
-- Privado: leitura via signed URL OU via policies abaixo
insert into storage.buckets (id, name, public)
values ('ocorrencia-fotos', 'ocorrencia-fotos', false)
on conflict (id) do nothing;

-- ============================================================
-- 4) Helper: confere se o path (prefixo) pertence a um condomínio do usuário
-- ============================================================
-- Convenção de path: <condominio_id>/<qualquer-caminho>
-- Esta function é STABLE/SECURITY DEFINER pra rodar dentro da RLS de storage.objects.
create or replace function public.storage_path_in_user_condominios(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_onway()
    or exists (
      select 1
        from public.perfis p
       where p.id = auth.uid()
         and p.ativo = true
         and p.condominio_id is not null
         and starts_with(p_name, p.condominio_id::text || '/')
    );
$$;

grant execute on function public.storage_path_in_user_condominios(text) to authenticated;

-- ============================================================
-- 5) Policies no storage.objects para o bucket `ocorrencia-fotos`
-- ============================================================

-- SELECT: usuário só vê fotos do próprio condomínio
create policy "ocorrencia_fotos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ocorrencia-fotos'
    and public.storage_path_in_user_condominios(name)
  );

-- INSERT: usuário só faz upload em path do próprio condomínio
create policy "ocorrencia_fotos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ocorrencia-fotos'
    and public.storage_path_in_user_condominios(name)
  );

-- UPDATE: mesma regra (renomear/movimentar)
create policy "ocorrencia_fotos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ocorrencia-fotos'
    and public.storage_path_in_user_condominios(name)
  );

-- DELETE: admin_onway + administradora/sindico do condomínio
create policy "ocorrencia_fotos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ocorrencia-fotos'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

-- ============================================================
-- Fim 0004_ocorrencias_and_storage.sql
-- Próximas etapas (29-31): UI para criar/listar/detalhar ocorrências.
-- ============================================================
