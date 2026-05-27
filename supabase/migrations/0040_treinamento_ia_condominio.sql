-- 0040: campos pra "treinamento" leve da IA por condomínio.
-- modelo_notificacao_texto: texto extraído do PDF modelo, usado como guideline
-- de estilo pra Edge analyze-ocorrencia (entra no prompt como exemplo de redação).
-- ai_instrucoes: instruções customizadas opcionais que o síndico/admin pode escrever
-- (ex.: "este condomínio é mais formal", "sempre cite a convenção interna").

alter table public.condominios
  add column if not exists modelo_notificacao_texto text,
  add column if not exists ai_instrucoes            text;
