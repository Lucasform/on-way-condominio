-- 0095: contestação do morador também na NOTIFICAÇÃO (advertência), não só multa.
-- Aditivo: contestacoes ganha notificacao_id; multa_id vira opcional; exatamente
-- um dos dois. RLS e trigger espelham o comportamento da multa, sem quebrá-lo.

alter table public.contestacoes alter column multa_id drop not null;

alter table public.contestacoes
  add column if not exists notificacao_id uuid references public.notificacoes(id) on delete cascade;

-- Exatamente um alvo (multa OU notificação)
alter table public.contestacoes drop constraint if exists contestacoes_alvo_chk;
alter table public.contestacoes
  add constraint contestacoes_alvo_chk
  check ((multa_id is not null) <> (notificacao_id is not null));

create index if not exists contestacoes_notificacao_idx
  on public.contestacoes (notificacao_id, created_at);

-- ---- RLS: estende select/insert pra cobrir notificação ----
drop policy if exists contestacoes_select on public.contestacoes;
create policy contestacoes_select on public.contestacoes
  for select to authenticated
  using (
    (multa_id is not null and multa_id in (select id from public.multas))
    or (notificacao_id is not null and notificacao_id in (select id from public.notificacoes))
  );

drop policy if exists contestacoes_insert on public.contestacoes;
create policy contestacoes_insert on public.contestacoes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (
      (multa_id is not null and multa_id in (select id from public.multas))
      or (notificacao_id is not null and notificacao_id in (select id from public.notificacoes))
    )
  );

-- ---- Guard no trigger da MULTA: ignora inserts de notificação ----
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
  if new.multa_id is null then
    return new;  -- contestação de notificação tem trigger próprio
  end if;

  if new.autor_tipo = 'morador' then
    select condominio_id, status into v_condo, v_multa_status
      from public.multas where id = new.multa_id;
    if v_multa_status = 'aplicada' then
      update public.multas set status = 'contestada' where id = new.multa_id;
    end if;
    perform public.fanout_app_notification(
      v_condo, array['administradora','sindico'], 'multa',
      'Nova contestação de multa', left(new.mensagem, 200),
      '/multas/' || new.multa_id::text
    );
  end if;

  if new.autor_tipo = 'staff' then
    insert into public.app_notifications (user_id, condominio_id, tipo, titulo, conteudo, link)
    select pe.user_id, m.condominio_id, 'multa', 'Resposta à sua contestação',
           left(new.mensagem, 200), '/multas/' || m.id::text
      from public.multas m
      left join public.pessoas pe on pe.id = m.pessoa_id
     where m.id = new.multa_id and pe.user_id is not null and pe.user_id <> new.autor_id;
  end if;

  return new;
end;
$$;

-- ---- Trigger próprio da NOTIFICAÇÃO ----
create or replace function public.tg_contestacao_notif_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condo uuid;
  v_status text;
begin
  if new.notificacao_id is null then
    return new;
  end if;

  if new.autor_tipo = 'morador' then
    select condominio_id, status into v_condo, v_status
      from public.notificacoes where id = new.notificacao_id;
    if v_status in ('enviada','ciente','advertencia') then
      update public.notificacoes set status = 'contestada' where id = new.notificacao_id;
    end if;
    perform public.fanout_app_notification(
      v_condo, array['administradora','sindico'], 'ocorrencia',
      'Nova contestação de notificação', left(new.mensagem, 200),
      '/notificacoes/' || new.notificacao_id::text
    );
  end if;

  if new.autor_tipo = 'staff' then
    insert into public.app_notifications (user_id, condominio_id, tipo, titulo, conteudo, link)
    select pe.user_id, n.condominio_id, 'ocorrencia', 'Resposta à sua contestação',
           left(new.mensagem, 200), '/notificacoes/' || n.id::text
      from public.notificacoes n
      left join public.pessoas pe on pe.id = n.pessoa_id
     where n.id = new.notificacao_id and pe.user_id is not null and pe.user_id <> new.autor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contestacao_notif on public.contestacoes;
create trigger trg_contestacao_notif
after insert on public.contestacoes
for each row execute function public.tg_contestacao_notif_notify();
