-- 0090: votação configurável (modo de público) + voto por QR/convidado.
-- Tudo aditivo: votações existentes ficam modo 'todos' (comportamento atual,
-- voto por usuário autenticado). Só o modo 'qrcode' usa o voto por unidade.

-- Config da votação
alter table public.votacoes
  add column if not exists modo text not null default 'todos'
    check (modo in ('todos', 'qrcode')),
  add column if not exists codigo_acesso text;

comment on column public.votacoes.modo is
  'todos = todos os usuários do condomínio votam no app; qrcode = voto via QR/link (inclui convidado por unidade).';
comment on column public.votacoes.codigo_acesso is
  'Código (texto livre) exibido na assembleia; quando preenchido, é exigido pra votar.';

-- Voto de convidado / por unidade
alter table public.votos
  alter column user_id drop not null;

alter table public.votos
  add column if not exists unidade_id uuid references public.unidades(id) on delete set null,
  add column if not exists eleitor_nome text,
  add column if not exists verificado boolean not null default true;

comment on column public.votos.unidade_id is 'Unidade do eleitor (modo qrcode). Null nas votações por usuário (modo todos).';
comment on column public.votos.eleitor_nome is 'Nome informado pelo convidado sem conta (modo qrcode).';
comment on column public.votos.verificado is 'true = voto de usuário autenticado; false = convidado sem login.';

-- 1 voto por unidade quando há unidade (modo qrcode). Não afeta votos por usuário (unidade_id null).
create unique index if not exists votos_unidade_uniq
  on public.votos (votacao_id, unidade_id)
  where unidade_id is not null;
