-- 0078_condominio_white_label.sql
-- Personalizacao por condominio (white-label) — base pra subdominio e path slug.
-- Cliente resolve identidade pelo hostname (subdominio) ou path /c/<slug>.
-- Aplica logo, cor primaria, texto de login e imagem de fundo personalizadas.

alter table public.condominios
  add column if not exists slug                text,
  add column if not exists cor_primaria        text,
  add column if not exists texto_login         text,
  add column if not exists imagem_login_url    text,
  add column if not exists permite_signup      boolean not null default true,
  add column if not exists mensagem_boas_vindas text;

-- Slug unico e curto, formato kebab-case. Ex.: 'jardim-paulista', 'vila-mariana-12'.
-- Null permitido pra condos antigos; quando preenchido, deve ser unico.
create unique index if not exists condominios_slug_unique
  on public.condominios (lower(slug))
  where slug is not null;

-- Index pra lookup rapido por slug em landing pages
create index if not exists condominios_slug_idx
  on public.condominios (slug)
  where slug is not null;

-- Funcao publica (anon) pra resolver tema pelo slug sem precisar de auth.
-- Returna apenas campos visuais — sem dados sensiveis.
create or replace function public.condominio_brand_by_slug(p_slug text)
returns table (
  id                  uuid,
  nome                text,
  slug                text,
  logo_url            text,
  cor_primaria        text,
  texto_login         text,
  imagem_login_url    text,
  permite_signup      boolean,
  mensagem_boas_vindas text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.nome, c.slug, c.logo_url, c.cor_primaria,
    c.texto_login, c.imagem_login_url, c.permite_signup, c.mensagem_boas_vindas
  from public.condominios c
  where c.ativo = true
    and lower(c.slug) = lower(p_slug)
  limit 1;
$$;

-- Permite chamar anon (pre-login)
grant execute on function public.condominio_brand_by_slug(text) to anon, authenticated;
