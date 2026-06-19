insert into public.feature_flags (key, nome, descricao, ativo)
values ('solicitacoes', 'Solicitacoes', 'Canal de comunicacao formal morador gestao com Kanban.', true)
on conflict (key) do nothing;
