# OnWay Condomínio

Web app de gestão de condomínios — módulo administrativo (multas, notificações e IA).

> Esqueleto inicial. Nenhuma funcionalidade de negócio implementada ainda.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS 3
- React Router 7
- Supabase JS Client

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # depois preencha as variáveis
npm run dev
```

Abra http://localhost:5173.

## Variáveis de ambiente

| Variável                 | Descrição                  |
| ------------------------ | -------------------------- |
| `VITE_SUPABASE_URL`      | URL do projeto Supabase    |
| `VITE_SUPABASE_ANON_KEY` | Anon key do projeto        |

## Estrutura

```
src/
  assets/       imagens, fontes, etc.
  components/   componentes reutilizáveis
  hooks/        custom React hooks
  lib/          clients e utilitários (ex: supabase.ts)
  pages/        páginas roteadas
  types/        tipos TypeScript compartilhados
```
