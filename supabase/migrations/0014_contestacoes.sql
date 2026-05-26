-- 0014_contestacoes.sql
-- Fase 9, etapa 77 (parcial) do ROADMAP.
-- Contestação de multas em formato de "thread" simples (não é chat completo).
-- Morador escreve mensagens, staff responde, tudo vinculado à multa.

-- ============================================================
-- 1) Tabela contestacoes
-- ============================================================
create table public.contestacoes (
  id              uuid primary key default gen_random_uuid(),
  multa_id        uuid not null
                  references public.multas(id) on delete cascade,
  autor_id        uuid not null
                  references auth.users(id) on delete set default
                  default '00000000-0000-0000-0000-000000000000'::uuid,
  autor_tipo      text not null
                  check (autor_tipo in ('morador','staff')),
  mensagem        text not null,
  created_at      timestamptz not null default now()
);

create index contestacoes_multa_idx      on public.contestacoes (multa_id, created_at);
create index contestacoes_autor_idx      on public.contestacoes (autor_id);

-- ============================================================
-- 2) RLS — herda visibilidade da multa pai
-- ============================================================
alter table public.contestacoes enable row level security;
alter table public.contestacoes force row level security;

-- SELECT: se o user vê a multa, vê as contestações dela
create policy contestacoes_select on public.contestacoes
  for select to authenticated
  using (multa_id in (select id from public.multas));

-- INSERT: o user só pode postar como si próprio, em multas que ele vê
create policy contestacoes_insert on public.contestacoes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and multa_id in (select id from public.multas)
  );

-- UPDATE: o próprio autor pode editar (raro — útil pra typo)
create policy contestacoes_update on public.contestacoes
  for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

-- DELETE: o próprio autor + admin
create policy contestacoes_delete on public.contestacoes
  for delete to authenticated
  using (autor_id = auth.uid() or public.is_admin_onway());

-- ============================================================
-- 3) Habilita Realtime (pra ver mensagens novas em tempo real)
-- ============================================================
alter publication supabase_realtime add table public.contestacoes;

-- ============================================================
-- 4) Trigger: nova contestação do MORADOR ->
--    - muda status da multa pra 'contestada' (se estava aplicada)
--    - notifica administradora/sindico
-- ============================================================
create or replace function public.tg_contestacao_morador_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condo uuid;
  v_multa_status text;
begin
  if new.autor_tipo = 'morador' then
    select condominio_id, status into v_condo, v_multa_status
      from public.multas where id = new.multa_id;

    -- Se a multa estava 'aplicada', vira 'contestada'
    if v_multa_status = 'aplicada' then
      update public.multas
         set status = 'contestada'
       where id = new.multa_id;
    end if;

    -- Notifica staff
    perform public.fanout_app_notification(
      v_condo,
      array['administradora','sindico'],
      'multa',
      'Nova contestação de multa',
      left(new.mensagem, 200),
      '/multas/' || new.multa_id::text
    );
  end if;

  -- Se foi STAFF respondendo, notifica o morador (autor da pessoa vinculada)
  if new.autor_tipo = 'staff' then
    insert into public.app_notifications
      (user_id, condominio_id, tipo, titulo, conteudo, link)
    select pe.user_id, m.condominio_id, 'multa',
           'Resposta à sua contestação',
           left(new.mensagem, 200),
           '/multas/' || m.id::text
      from public.multas m
      left join public.pessoas pe on pe.id = m.pessoa_id
     where m.id = new.multa_id
       and pe.user_id is not null
       and pe.user_id <> new.autor_id;
  end if;

  return new;
end;
$$;

create trigger trg_contestacao_notify
after insert on public.contestacoes
for each row execute function public.tg_contestacao_morador_notify();

-- ============================================================
-- Fim 0014_contestacoes.sql
-- ============================================================
