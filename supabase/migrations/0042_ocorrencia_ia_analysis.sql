-- 0042: persiste a última análise da IA em cada ocorrência.
-- Antes ficava só em sessionStorage e perdia ao trocar de página.
-- Agora vive no banco, sobrevive entre sessões, e os forms de notificação/multa
-- conseguem ler o embasamento (artigo + minuta + justificativa) pra pré-preencher.

alter table public.ocorrencias
  add column if not exists ia_analysis    jsonb,
  add column if not exists ia_analisada_em timestamptz;
