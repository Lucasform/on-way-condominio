-- 0041: tabela `condominio_anexos` — suporta múltiplos PDFs por condomínio,
-- categorizados por tipo. Substitui os 2 campos singletons em condominios
-- (regimento_pdf_url e modelo_notificacao_url) que ficam por compatibilidade
-- mas não são mais a fonte de verdade.
--
-- Tipos:
--   regimento           — convenção, regimento interno, normas (vira artigos)
--   modelo_notificacao  — modelo PDF de notificação/advertência (guia de estilo)
--   modelo_multa        — modelo PDF de multa formal (guia de estilo)
--   outro               — qualquer outro doc do condomínio

create table public.condominio_anexos (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references public.condominios(id) on delete cascade,
  tipo                text not null
                      check (tipo in ('regimento','modelo_notificacao','modelo_multa','outro')),
  nome                text not null,            -- nome dado pelo usuário ("Convenção 2024", "Modelo padrão", etc)
  url                 text not null,            -- URL pública no Storage
  texto_extraido      text,                     -- texto extraído pelo parse (usado nos modelos)
  artigos_extraidos   integer,                  -- quantos artigos foram criados (regimento)
  processado_em       timestamptz,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index condominio_anexos_condo_tipo_idx on public.condominio_anexos (condominio_id, tipo) where ativo;

create trigger trg_condominio_anexos_updated_at
before update on public.condominio_anexos
for each row execute function public.set_updated_at();

-- RLS: staff do condomínio vê e gerencia; admin_onway tem visão global
alter table public.condominio_anexos enable row level security;

create policy condo_anexos_select on public.condominio_anexos
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy condo_anexos_insert on public.condominio_anexos
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico','portaria')
    )
  );

create policy condo_anexos_update on public.condominio_anexos
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

create policy condo_anexos_delete on public.condominio_anexos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) = 'sindico'
  );

-- Migração: importa anexos antigos dos campos singletons (se houver)
insert into public.condominio_anexos (condominio_id, tipo, nome, url, texto_extraido, processado_em)
select id, 'regimento', 'Regimento interno', regimento_pdf_url, null, null
  from public.condominios
 where regimento_pdf_url is not null;

insert into public.condominio_anexos (condominio_id, tipo, nome, url, texto_extraido, processado_em)
select id, 'modelo_notificacao', 'Modelo de notificação', modelo_notificacao_url,
       modelo_notificacao_texto,
       case when modelo_notificacao_texto is not null then now() else null end
  from public.condominios
 where modelo_notificacao_url is not null;
