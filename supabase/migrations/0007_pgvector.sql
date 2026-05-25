-- 0007_pgvector.sql
-- Fase 3, etapa 38 (parcial) do ROADMAP.
-- Habilita a extensão pgvector e adiciona coluna `embedding` em regimento_artigos.
-- Dimensão 384 = padrão da embedding gte-small (gratuita, roda local na Edge Function via Transformers.js).
-- A geração das embeddings em si será feita por uma Edge Function (etapa 38 final / 39).

-- ============================================================
-- 1) Extensão pgvector
-- ============================================================
create extension if not exists vector;

-- ============================================================
-- 2) Coluna de embedding em regimento_artigos
-- ============================================================
alter table public.regimento_artigos
  add column if not exists embedding vector(384),
  add column if not exists embedding_atualizado_em timestamptz;

-- Índice HNSW para busca semântica eficiente (similaridade cosseno).
-- IVFFlat também funciona, mas HNSW é mais robusto para datasets pequenos/médios.
create index if not exists regimento_embedding_idx
  on public.regimento_artigos
  using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- 3) Função de busca semântica
-- ============================================================
-- Retorna os top-N artigos mais relevantes para uma query embedding,
-- escopado ao condomínio do usuário (via RLS — esta function NÃO usa
-- security definer; ela respeita as policies de leitura).

create or replace function public.match_regimento_artigos(
  query_embedding vector(384),
  p_condominio_id uuid,
  match_count integer default 5,
  similarity_threshold float default 0.5
)
returns table (
  id uuid,
  numero text,
  titulo text,
  conteudo text,
  similarity float
)
language sql
stable
as $$
  select r.id, r.numero, r.titulo, r.conteudo,
         1 - (r.embedding <=> query_embedding) as similarity
    from public.regimento_artigos r
   where r.condominio_id = p_condominio_id
     and r.ativo = true
     and r.embedding is not null
     and (1 - (r.embedding <=> query_embedding)) >= similarity_threshold
   order by r.embedding <=> query_embedding asc
   limit match_count;
$$;

grant execute on function public.match_regimento_artigos(vector, uuid, integer, float) to authenticated;

-- ============================================================
-- Fim 0007_pgvector.sql
-- Próximo: Edge Function que gera embeddings (etapa 38 final).
-- ============================================================
