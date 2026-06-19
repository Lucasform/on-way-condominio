-- Módulo Solicitações: canal morador → gestão com histórico tipo chamado
-- Kanban (enviado / analise / respondido)

create table if not exists public.solicitacoes (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references public.condominios(id) on delete cascade,
  unidade_id      uuid references public.unidades(id) on delete set null,
  autor_id        uuid not null references auth.users(id) on delete cascade,
  tipo            text not null check (tipo in ('duvida','reclamacao','sugestao','outros')),
  titulo          text not null,
  descricao       text not null,
  status          text not null default 'enviado' check (status in ('enviado','analise','respondido')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists solicitacoes_condominio_idx on public.solicitacoes(condominio_id);
create index if not exists solicitacoes_autor_idx      on public.solicitacoes(autor_id);
create index if not exists solicitacoes_status_idx     on public.solicitacoes(status);

create table if not exists public.solicitacao_mensagens (
  id              uuid primary key default gen_random_uuid(),
  solicitacao_id  uuid not null references public.solicitacoes(id) on delete cascade,
  autor_id        uuid not null references auth.users(id) on delete cascade,
  texto           text not null,
  criado_at       timestamptz not null default now()
);

create index if not exists sol_mensagens_solicitacao_idx on public.solicitacao_mensagens(solicitacao_id);

-- RLS
alter table public.solicitacoes enable row level security;
alter table public.solicitacao_mensagens enable row level security;

-- solicitacoes: morador vê as próprias; gestor vê todas do seu condo
create policy "solicitacoes_select" on public.solicitacoes
  for select using (
    auth.uid() = autor_id
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.ativo = true
        and p.role in ('admin_onway','admin','administradora','sindico','subsindico')
        and (p.condominio_id = solicitacoes.condominio_id or p.condominio_id is null)
    )
  );

create policy "solicitacoes_insert" on public.solicitacoes
  for insert with check (auth.uid() = autor_id);

create policy "solicitacoes_update" on public.solicitacoes
  for update using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.ativo = true
        and p.role in ('admin_onway','admin','administradora','sindico','subsindico')
        and (p.condominio_id = solicitacoes.condominio_id or p.condominio_id is null)
    )
  );

-- mensagens: acesso via solicitacao
create policy "sol_mensagens_select" on public.solicitacao_mensagens
  for select using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_mensagens.solicitacao_id
        and (
          s.autor_id = auth.uid()
          or exists (
            select 1 from public.perfis p
            where p.id = auth.uid()
              and p.ativo = true
              and p.role in ('admin_onway','admin','administradora','sindico','subsindico')
              and (p.condominio_id = s.condominio_id or p.condominio_id is null)
          )
        )
    )
  );

create policy "sol_mensagens_insert" on public.solicitacao_mensagens
  for insert with check (
    auth.uid() = autor_id
    and exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_mensagens.solicitacao_id
        and (
          s.autor_id = auth.uid()
          or exists (
            select 1 from public.perfis p
            where p.id = auth.uid()
              and p.ativo = true
              and p.role in ('admin_onway','admin','administradora','sindico','subsindico')
              and (p.condominio_id = s.condominio_id or p.condominio_id is null)
          )
        )
    )
  );
