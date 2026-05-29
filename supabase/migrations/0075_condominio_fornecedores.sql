-- 0075_condominio_fornecedores.sql
-- Aba publica de fornecedores do condominio. Pessoas que prestam servico
-- dentro do condominio (diarista, jardineiro, manutencao, feirante etc.)
-- podem se cadastrar pra serem reconhecidos. Portaria/sindico aprovam.
-- Categoria especial "feira" cobre feirantes que vem em dia fixo.
-- v1 sem auto-cadastro publico via link (vira numa leva 2 com codigo).

create table public.condominio_fornecedores (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,

  -- Dados do fornecedor
  nome            text not null,
  tipo            text not null default 'prestador'
                  check (tipo in (
                    'prestador',     -- generico
                    'diarista',
                    'jardineiro',
                    'manutencao',
                    'pintor',
                    'eletricista',
                    'encanador',
                    'feirante',      -- feira semanal do condo
                    'entregador',
                    'outro'
                  )),
  servico         text,              -- descricao livre do que faz
  telefone        text,
  email           text,
  documento       text,              -- CPF ou CNPJ
  foto_url        text,

  -- Quando atende (jsonb pra flexibilidade)
  -- ex.: { "dias": ["seg","qua","sex"], "horario": "08:00-12:00" }
  -- ex feira: { "dias": ["sab"], "horario": "07:00-12:00", "ponto": "rua interna" }
  agenda          jsonb,

  -- Quem cadastrou e fluxo de aprovacao
  cadastrado_por  uuid references auth.users(id) on delete set null,
  unidade_id      uuid references public.unidades(id) on delete set null,
                  -- unidade que indicou (opcional, vazio = condominio inteiro)
  status          text not null default 'pendente'
                  check (status in ('pendente','aprovado','inativo','recusado')),
  aprovado_por    uuid references auth.users(id) on delete set null,
  aprovado_em     timestamptz,
  motivo_recusa   text,

  -- Visibilidade
  publico         boolean not null default true,
                  -- true = visivel pra todos os moradores
                  -- false = so staff (rascunho ou em revisao)

  observacoes     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index condominio_fornecedores_condominio_idx
  on public.condominio_fornecedores (condominio_id, status);

create index condominio_fornecedores_tipo_idx
  on public.condominio_fornecedores (condominio_id, tipo)
  where status = 'aprovado';

create trigger trg_condominio_fornecedores_updated_at
before update on public.condominio_fornecedores
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.condominio_fornecedores enable row level security;
alter table public.condominio_fornecedores force row level security;

-- SELECT
-- - admin_onway: tudo
-- - staff: tudo do condo
-- - morador: so aprovado + publico OU os que ele cadastrou
create policy condominio_fornecedores_select on public.condominio_fornecedores
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria','ronda','conselheiro'
        )
        or (status = 'aprovado' and publico = true)
        or cadastrado_por = auth.uid()
      )
    )
  );

-- INSERT: admin, staff, qualquer morador do condo (vai como pendente)
create policy condominio_fornecedores_insert on public.condominio_fornecedores
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- UPDATE: admin, staff aprovam/editam; cadastrante edita enquanto pendente
create policy condominio_fornecedores_update on public.condominio_fornecedores
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in (
          'administradora','sindico','portaria'
        )
        or (cadastrado_por = auth.uid() and status = 'pendente')
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
        or (cadastrado_por = auth.uid() and status = 'pendente')
      )
    )
  );

-- DELETE: admin_onway + sindico/administradora; cadastrante so se pendente
create policy condominio_fornecedores_delete on public.condominio_fornecedores
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and (
        public.user_role_in(condominio_id) in ('administradora','sindico')
        or (cadastrado_por = auth.uid() and status = 'pendente')
      )
    )
  );
