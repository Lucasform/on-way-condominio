-- 0097_votacao_mesa_assinaturas.sql
-- 1. Bloqueia troca de voto quando votação está encerrada
-- 2. Mesa diretora por assembleia (JSONB: [{nome,cpf,cargo,assinatura_url}])
-- 3. Storage bucket para assinaturas da mesa

-- ============================================================
-- 1. Fix votos_update — bloqueia após encerramento manual
-- ============================================================
drop policy if exists votos_update on public.votos;
create policy votos_update on public.votos
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.votacoes v
       where v.id = votos.votacao_id
         and v.status = 'aberta'
         and (v.data_fim is null or v.data_fim > now())
    )
  )
  with check (user_id = auth.uid());

-- ============================================================
-- 2. Mesa diretora na assembleia
-- Estrutura JSONB: [{nome, cpf, cargo, assinatura_url}]
-- cargo: 'presidente_mesa' | 'secretario' | 'coordenador' | 'outro'
-- ============================================================
alter table public.assembleias
  add column if not exists mesa_diretora jsonb default '[]'::jsonb;

comment on column public.assembleias.mesa_diretora is
  'Mesa diretora da assembleia: [{nome, cpf, cargo, assinatura_url}]. Usado para assinar a ata de votação.';

-- ============================================================
-- 3. Storage bucket para assinaturas da mesa (reutiliza 'assinaturas')
-- Já existe — sem necessidade de criar novo bucket
-- ============================================================
