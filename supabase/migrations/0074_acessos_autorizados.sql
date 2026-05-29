-- 0074_acessos_autorizados.sql
-- Estrutura inicial pra liberacao de acesso de visitantes/prestadores/etc.
-- Morador cria a autorizacao pra unidade dele; portaria libera entrada/saida.
-- v1 sem recorrencia, sem PIN, sem foto. Esqueleto pra ajustar depois.

-- ============================================================
-- 1) Tabela acessos_autorizados
-- ============================================================
create table public.acessos_autorizados (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null
                    references public.condominios(id) on delete cascade,
  unidade_id        uuid not null
                    references public.unidades(id) on delete cascade,
  criado_por        uuid references auth.users(id) on delete set null,
  pessoa_id         uuid references public.pessoas(id) on delete set null,

  -- identificacao do autorizado (visitante externo nao tem pessoa cadastrada)
  nome              text not null,
  documento_tipo    text check (documento_tipo in ('cpf','rg','cnh','passaporte','outro')),
  documento_numero  text,
  telefone          text,

  tipo              text not null default 'visitante'
                    check (tipo in ('visitante','prestador','entregador','familiar','fixo')),

  -- Modalidade de vigencia (pratica de mercado)
  -- hoje         : valida ate o fim do dia de criacao
  -- data         : 1 dia especifico (vigencia_inicio define o dia)
  -- periodo      : intervalo entre inicio e fim
  -- indefinido   : sem data fim, vale ate revogar
  -- recorrente   : recorrencia por dias da semana + horario (campo recorrencia)
  modalidade_vigencia text not null default 'data'
                      check (modalidade_vigencia in (
                        'hoje','data','periodo','indefinido','recorrente'
                      )),

  vigencia_inicio   timestamptz not null default now(),
  vigencia_fim      timestamptz,

  -- Recorrencia (jsonb): { dias_semana: ['seg','qua','sex'],
  --                        horario_inicio: '08:00', horario_fim: '17:00' }
  recorrencia       jsonb,

  status            text not null default 'ativo'
                    check (status in ('ativo','usado','expirado','revogado','negado')),

  -- Especificacoes de mercado
  uso_unico                  boolean not null default false,
                             -- true = expira na primeira entrada
  placa_veiculo              text,
  acompanhantes_permitidos   integer not null default 0,
                             -- 0 = so o autorizado; >0 = pode trazer N
  notificar_entrada          boolean not null default true,
                             -- push pro morador quando portaria liberar
  foto_url                   text,

  observacao        text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index acessos_autorizados_condominio_idx
  on public.acessos_autorizados (condominio_id);

create index acessos_autorizados_unidade_idx
  on public.acessos_autorizados (unidade_id, status, vigencia_inicio desc);

create index acessos_autorizados_vigencia_idx
  on public.acessos_autorizados (condominio_id, status, vigencia_inicio)
  where status = 'ativo';

create trigger trg_acessos_autorizados_updated_at
before update on public.acessos_autorizados
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Tabela acesso_eventos (timeline entrada/saida/negada)
-- ============================================================
create table public.acesso_eventos (
  id                uuid primary key default gen_random_uuid(),
  acesso_id         uuid not null
                    references public.acessos_autorizados(id) on delete cascade,
  condominio_id     uuid not null
                    references public.condominios(id) on delete cascade,
  tipo              text not null
                    check (tipo in ('entrada','saida','negada','revogada')),
  registrado_por    uuid references auth.users(id) on delete set null,
  motivo            text,
  created_at        timestamptz not null default now()
);

create index acesso_eventos_acesso_idx
  on public.acesso_eventos (acesso_id, created_at desc);

-- ============================================================
-- 3) RLS acessos_autorizados
-- ============================================================
alter table public.acessos_autorizados enable row level security;
alter table public.acessos_autorizados force row level security;

-- SELECT: admin_onway, staff do condo, morador da unidade
create policy acessos_autorizados_select on public.acessos_autorizados
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria','ronda','conselheiro'
        )
        or unidade_id in (
          select unidade_id from public.pessoas
          where user_id = auth.uid() and unidade_id is not null
        )
      )
    )
  );

-- INSERT: admin_onway, staff (portaria registra visitante de balcao),
-- morador da unidade
create policy acessos_autorizados_insert on public.acessos_autorizados
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria'
        )
        or unidade_id in (
          select unidade_id from public.pessoas
          where user_id = auth.uid() and unidade_id is not null
        )
      )
    )
  );

-- UPDATE: admin_onway, staff, criador
create policy acessos_autorizados_update on public.acessos_autorizados
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria'
        )
        or criado_por = auth.uid()
      )
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria'
        )
        or criado_por = auth.uid()
      )
    )
  );

-- DELETE: admin_onway, sindico/administradora, criador
create policy acessos_autorizados_delete on public.acessos_autorizados
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in ('administradora','sindico')
        or criado_por = auth.uid()
      )
    )
  );

-- ============================================================
-- 4) RLS acesso_eventos
-- ============================================================
alter table public.acesso_eventos enable row level security;
alter table public.acesso_eventos force row level security;

-- SELECT: mesma visibilidade do acesso pai
create policy acesso_eventos_select on public.acesso_eventos
  for select to authenticated
  using (
    public.is_admin_onway()
    or exists (
      select 1 from public.acessos_autorizados a
      where a.id = acesso_eventos.acesso_id
        and a.condominio_id in (select public.user_condominios())
        and (
          public.user_role_in(a.condominio_id) in (
            'administradora','sindico','portaria','ronda','conselheiro'
          )
          or a.unidade_id in (
            select unidade_id from public.pessoas
            where user_id = auth.uid() and unidade_id is not null
          )
        )
    )
  );

-- INSERT: portaria, staff, admin (morador nao registra entrada/saida sozinho)
create policy acesso_eventos_insert on public.acesso_eventos
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in (
        'administradora','sindico','portaria'
      )
    )
  );

-- DELETE: admin_onway + sindico (correcao de registro errado)
create policy acesso_eventos_delete on public.acesso_eventos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 5) Trigger: ao registrar evento, sincroniza status do acesso pai
-- ============================================================
create or replace function public.tg_acesso_evento_sync_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'entrada' then
    update public.acessos_autorizados
       set status = 'usado'
     where id = new.acesso_id
       and status = 'ativo';
  elsif new.tipo = 'negada' then
    update public.acessos_autorizados
       set status = 'negado'
     where id = new.acesso_id
       and status = 'ativo';
  elsif new.tipo = 'revogada' then
    update public.acessos_autorizados
       set status = 'revogado'
     where id = new.acesso_id;
  end if;
  return new;
end;
$$;

create trigger trg_acesso_evento_sync_status
after insert on public.acesso_eventos
for each row execute function public.tg_acesso_evento_sync_status();
