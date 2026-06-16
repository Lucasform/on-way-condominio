-- 0099_feature_flags.sql
-- Feature flags globais: admin_onway ativa/desativa funcionalidades do produto.

create table public.feature_flags (
  key         text primary key,
  nome        text not null,
  descricao   text,
  ativo       boolean not null default true,
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Flags globais de funcionalidade. Admin OnWay controla o que está disponível no produto.';

create or replace function public.set_feature_flags_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute procedure public.set_feature_flags_updated_at();

alter table public.feature_flags enable row level security;

create policy feature_flags_select on public.feature_flags
  for select to authenticated using (true);

create policy feature_flags_update on public.feature_flags
  for update to authenticated
  using (exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway'));

-- Seed inicial
insert into public.feature_flags (key, nome, descricao, ativo) values
  ('portaria',     'Serviços de Portaria',    'Controle de encomendas e plantão de portaria',              true),
  ('acessos',      'Acessos Autorizados',     'Liberação de visitas e acessos de terceiros',               true),
  ('moradores',    'Moradores',               'Gestão de unidades, pessoas, veículos e pets',              true),
  ('mural',        'Mural Informativo',       'Publicação de avisos no mural do condomínio',               true),
  ('ocorrencias',  'Ocorrências',             'Registro e acompanhamento de ocorrências',                  true),
  ('chat',         'Chat Interno',            'Mensagens entre moradores e gestão',                        true),
  ('comunicados',  'Comunicados',             'Envio de comunicados oficiais para moradores',              true),
  ('classificados','Classificados',           'Anúncios entre moradores, itens à venda ou serviços',       true),
  ('multas',       'Multas',                  'Aplicação e acompanhamento de multas por infração',         true),
  ('chamados',     'Chamados',                'Abertura e gestão de chamados de manutenção',               true),
  ('calendario',   'Calendário',              'Agenda de eventos e compromissos do condomínio',            true),
  ('assembleias',  'Assembleias e Votações',  'Gestão de assembleias digitais com votação e ata em PDF',   true),
  ('servicos',     'Prestação de Serviços',   'Cadastro e controle de prestadores de serviço',            false),
  ('regimento',    'Regimento Interno',       'Acesso e gestão do regimento interno do condomínio',        false),
  ('relatorios',   'Relatórios',              'Relatórios gerenciais e exportações em Excel/PDF',          false),
  ('whatsapp',     'WhatsApp',                'Integração com WhatsApp via Evolution API',                 false),
  ('reservas',     'Reserva de Espaços',      'Agendamento de áreas comuns como salão, churrasqueira etc.',false)
on conflict do nothing;
