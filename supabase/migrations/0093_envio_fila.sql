-- 0093: fila de reprocesso de envios (e-mail/WhatsApp).
-- O envio imediato continua igual; só o que FALHA entra na fila e é
-- reprocessado pela edge `processar-envio-fila` (cron 3min) com backoff.
-- WhatsApp é tratado com cuidado anti-ban: cap por rodada, sequencial com
-- delay, máx 3 tentativas e SEM retry em falha permanente (número sem WhatsApp).

create table if not exists public.envio_fila (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid references public.condominios(id) on delete cascade,
  canal           text not null check (canal in ('email', 'whatsapp')),
  payload         jsonb not null,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'enviado', 'falhou', 'cancelado')),
  tentativas      integer not null default 0,
  max_tentativas  integer not null default 3,
  proxima_em      timestamptz not null default now(),
  ultimo_erro     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists envio_fila_pendentes_idx
  on public.envio_fila (canal, proxima_em)
  where status = 'pendente';

alter table public.envio_fila enable row level security;
alter table public.envio_fila force row level security;

-- Leitura: admin OnWay ou staff do condomínio. Escrita é via service_role (edges).
create policy envio_fila_select on public.envio_fila
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- Agendamento: a cada 3 minutos.
select cron.schedule(
  'onway_envio_fila',
  '*/3 * * * *',
  $$ select public.invocar_edge_function('processar-envio-fila'); $$
);
