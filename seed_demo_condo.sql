insert into public.condominios (
  nome, slug, cidade, estado, endereco, bairro, cep,
  cor_primaria, texto_login, mensagem_boas_vindas,
  permite_signup, ativo
)
values (
  'Residencial OnWay Demo',
  'demo',
  'São Paulo',
  'SP',
  'Av. Paulista, 1000',
  'Bela Vista',
  '01310-100',
  '#2563eb',
  'Bem-vindo ao Residencial OnWay Demo',
  'Olá! Este é o condomínio de demonstração da plataforma OnWay. Explore todas as funcionalidades disponíveis.',
  true,
  true
);

select id, nome, slug from public.condominios where slug = 'demo';
