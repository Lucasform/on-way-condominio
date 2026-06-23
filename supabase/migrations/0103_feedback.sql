-- 0103_feedback.sql
-- Loop estruturado de feedback do usuário (item 17 do checklist Founder's Playbook).
-- Aditivo, sem breaking change. Multi-tenant por condominio_id + RLS.

create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid references public.condominios(id) on delete set null,
  autor_id      uuid references auth.users(id) on delete set null,
  tipo          text not null default 'sugestao' check (tipo in ('sugestao','problema','elogio','outro')),
  mensagem      text not null check (char_length(mensagem) between 3 and 4000),
  status        text not null default 'novo' check (status in ('novo','em_analise','resolvido','arquivado')),
  created_at    timestamptz not null default now()
);

create index if not exists feedback_condominio_idx on public.feedback (condominio_id, created_at desc);

alter table public.feedback enable row level security;

-- O autor cria o próprio feedback.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (autor_id = auth.uid());

-- O autor vê o que enviou; staff do condomínio e admin OnWay veem o do escopo.
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated
  using (
    autor_id = auth.uid()
    or public.is_admin_onway()
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.condominio_id = feedback.condominio_id
        and p.role in ('administradora','sindico')
    )
  );

-- Staff e admin atualizam o status (triagem).
drop policy if exists feedback_update_staff on public.feedback;
create policy feedback_update_staff on public.feedback
  for update to authenticated
  using (
    public.is_admin_onway()
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.condominio_id = feedback.condominio_id
        and p.role in ('administradora','sindico')
    )
  );
