-- Migration 0113: Feature flags individuais para Pets e Veículos
-- Antes estavam agrupados sob 'moradores'; agora têm flags próprias
-- para que o síndico possa ligar/desligar cada um separadamente.

insert into public.feature_flags (key, nome, descricao, ativo) values
  ('pets',     'Pets',     'Cadastro de animais de estimação por unidade',     true),
  ('veiculos', 'Veículos', 'Controle de veículos dos condôminos por unidade',  true)
on conflict (key) do nothing;

-- Adicionar 'solicitacoes' se ainda não existir (criado em leva anterior)
insert into public.feature_flags (key, nome, descricao, ativo) values
  ('solicitacoes', 'Solicitações', 'Solicitações de moradores para a gestão', true)
on conflict (key) do nothing;
