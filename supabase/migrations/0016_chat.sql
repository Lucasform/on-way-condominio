-- 0016_chat.sql
-- Fase 4, etapas 49, 50, 51, 53 do ROADMAP.
-- Chat interno: conversas + mensagens, com Realtime.
-- Morador abre conversa, staff atende.

-- ============================================================
-- 1) Tabela conversas
-- ============================================================
create table public.conversas (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null
                      references public.condominios(id) on delete cascade,
  morador_user_id     uuid not null
                      references auth.users(id) on delete cascade,
  assunto             text not null default 'Outro'
                      check (assunto in ('multa','encomenda','manutencao','sugestao','outro')),
  status              text not null default 'aberta'
                      check (status in
                        ('aberta','aguardando_humano','em_atendimento','encerrada')),
  atribuida_para      uuid
                      references auth.users(id) on delete set null,
  ultima_mensagem_at  timestamptz default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index conversas_condominio_status_idx on public.conversas (condominio_id, status, ultima_mensagem_at desc);
create index conversas_morador_idx on public.conversas (morador_user_id, ultima_mensagem_at desc);
create index conversas_atribuida_idx on public.conversas (atribuida_para) where atribuida_para is not null;

create trigger trg_conversas_updated_at
before update on public.conversas
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Tabela mensagens
-- ============================================================
create table public.mensagens (
  id              uuid primary key default gen_random_uuid(),
  conversa_id     uuid not null
                  references public.conversas(id) on delete cascade,
  autor_id        uuid
                  references auth.users(id) on delete set null,
  autor_tipo      text not null
                  check (autor_tipo in ('morador','staff','bot','sistema')),
  conteudo        text not null,
  metadata        jsonb,
  lida_em         timestamptz,
  created_at      timestamptz not null default now()
);

create index mensagens_conversa_idx on public.mensagens (conversa_id, created_at);

-- ============================================================
-- 3) Trigger: ao inserir mensagem, atualiza ultima_mensagem_at da conversa
-- ============================================================
create or replace function public.tg_mensagem_touch_conversa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversas
     set ultima_mensagem_at = new.created_at
   where id = new.conversa_id;
  return new;
end;
$$;

create trigger trg_mensagens_touch_conversa
after insert on public.mensagens
for each row execute function public.tg_mensagem_touch_conversa();

-- ============================================================
-- 4) RLS — conversas
-- ============================================================
alter table public.conversas enable row level security;
alter table public.conversas force row level security;

-- SELECT: morador vê próprias; staff vê todas do condomínio
create policy conversas_select on public.conversas
  for select to authenticated
  using (
    public.is_admin_onway()
    or morador_user_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
  );

-- INSERT: morador cria pra si própria, no condo dele.
-- Trigger no app força morador_user_id = auth.uid(); aqui validamos também.
-- Limite (etapa 53): máximo 3 conversas abertas por morador.
create or replace function public.check_limite_conversas_abertas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.status in ('aberta','aguardando_humano') then
    select count(*) into v_count
      from public.conversas
     where morador_user_id = new.morador_user_id
       and status in ('aberta','aguardando_humano','em_atendimento');
    if v_count >= 3 then
      raise exception 'Limite de 3 conversas abertas atingido. Encerre uma antes de abrir outra.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_conversas_limite
before insert on public.conversas
for each row execute function public.check_limite_conversas_abertas();

create policy conversas_insert on public.conversas
  for insert to authenticated
  with check (
    morador_user_id = auth.uid()
    and (
      public.is_admin_onway()
      or condominio_id in (select public.user_condominios())
    )
  );

-- UPDATE: morador pode encerrar a própria; staff faz qualquer transição
create policy conversas_update on public.conversas
  for update to authenticated
  using (
    public.is_admin_onway()
    or morador_user_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
  )
  with check (
    public.is_admin_onway()
    or morador_user_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
  );

-- DELETE: só admin
create policy conversas_delete on public.conversas
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 5) RLS — mensagens
-- ============================================================
alter table public.mensagens enable row level security;
alter table public.mensagens force row level security;

-- SELECT: herda da conversa
create policy mensagens_select on public.mensagens
  for select to authenticated
  using (conversa_id in (select id from public.conversas));

-- INSERT: autor = auth.uid(), na conversa que ele vê
create policy mensagens_insert on public.mensagens
  for insert to authenticated
  with check (
    (autor_id = auth.uid() or autor_tipo in ('bot','sistema'))
    and conversa_id in (select id from public.conversas)
  );

-- UPDATE: só pra marcar lida (autor_id pode editar campo lida_em). Trivial.
create policy mensagens_update on public.mensagens
  for update to authenticated
  using (conversa_id in (select id from public.conversas))
  with check (conversa_id in (select id from public.conversas));

-- ============================================================
-- 6) Realtime
-- ============================================================
alter publication supabase_realtime add table public.conversas;
alter publication supabase_realtime add table public.mensagens;

-- ============================================================
-- 7) Trigger: notifica via app_notifications quando staff responde morador
-- ============================================================
create or replace function public.tg_mensagem_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condo uuid;
  v_morador uuid;
begin
  select condominio_id, morador_user_id into v_condo, v_morador
    from public.conversas where id = new.conversa_id;

  -- Staff respondeu morador → notifica morador
  if new.autor_tipo = 'staff' and v_morador is not null and v_morador <> coalesce(new.autor_id, '00000000-0000-0000-0000-000000000000') then
    insert into public.app_notifications
      (user_id, condominio_id, tipo, titulo, conteudo, link)
    values (v_morador, v_condo, 'sistema',
            'Nova mensagem da administração',
            left(new.conteudo, 200),
            '/chat/' || new.conversa_id::text);
  end if;

  -- Morador mandou mensagem em conversa não-em-atendimento → notifica staff
  if new.autor_tipo = 'morador' then
    -- Atualiza status pra aguardando_humano se estava aberta
    update public.conversas
       set status = 'aguardando_humano'
     where id = new.conversa_id and status = 'aberta';

    perform public.fanout_app_notification(
      v_condo,
      array['administradora','sindico'],
      'sistema',
      'Nova mensagem do morador',
      left(new.conteudo, 200),
      '/chat/' || new.conversa_id::text
    );
  end if;

  return new;
end;
$$;

create trigger trg_mensagens_notify
after insert on public.mensagens
for each row execute function public.tg_mensagem_notify();

-- ============================================================
-- Fim 0016_chat.sql
-- ============================================================
