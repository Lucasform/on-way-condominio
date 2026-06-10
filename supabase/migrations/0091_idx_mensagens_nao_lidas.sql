-- 0091: índice parcial pra acelerar a contagem de mensagens não-lidas
-- (badges de chat: unreadCountsByConversa / countConversasNaoLidas).
-- Só indexa as linhas não-lidas (lida_em is null), que é o que as queries filtram.

create index if not exists mensagens_nao_lidas_idx
  on public.mensagens (conversa_id, autor_id)
  where lida_em is null;
