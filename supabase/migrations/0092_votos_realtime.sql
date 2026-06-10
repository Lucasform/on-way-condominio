-- 0092: habilita realtime na tabela votos pra apuração ao vivo na assembleia.
-- Idempotente: ignora se a tabela já estiver na publicação.

do $$
begin
  alter publication supabase_realtime add table public.votos;
exception
  when duplicate_object then null;
end $$;
