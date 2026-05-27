-- 0053_pessoa_residencial_exige_unidade.sql
-- Trigger que reforca no banco: pessoa com vinculo residencial precisa
-- ter unidade_id. Funcionario e outro continuam sem essa restricao.
--
-- Vinculos residenciais: titular, conjuge, filho, dependente, inquilino, morador

create or replace function public.check_pessoa_residencial_tem_unidade()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_vinculo in ('titular','conjuge','filho','dependente','inquilino','morador')
     and new.unidade_id is null then
    raise exception 'Pessoa com vínculo % precisa estar associada a uma unidade do condomínio.', new.tipo_vinculo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pessoa_residencial_unidade on public.pessoas;
create trigger trg_pessoa_residencial_unidade
before insert or update on public.pessoas
for each row execute function public.check_pessoa_residencial_tem_unidade();
