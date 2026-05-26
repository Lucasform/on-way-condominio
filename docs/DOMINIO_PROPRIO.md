# Apontar domínio próprio (`app.onwaytech.com.br`) para o Vercel

## 1. No Vercel
1. Acesse https://vercel.com → projeto `on-way-condominio` → **Settings → Domains**
2. Clique em **Add** e digite `app.onwaytech.com.br`
3. O Vercel vai mostrar um registro DNS a configurar. Copie esse valor (geralmente CNAME para `cname.vercel-dns.com`).

## 2. No provedor DNS do `onwaytech.com.br`
Adicione um registro:

| Tipo  | Nome | Valor                  | TTL  |
|-------|------|------------------------|------|
| CNAME | app  | cname.vercel-dns.com   | 3600 |

Salve e aguarde propagar (5-30 min, raramente até 24h).

Verificar propagação:
```
nslookup app.onwaytech.com.br
```
Deve retornar IPs do Vercel.

## 3. No Vercel novamente
- O domínio passará de **Pending** para **Valid Configuration** automaticamente.
- O Vercel emite certificado SSL via Let's Encrypt em ~1 min.

## 4. No Supabase (Site URL + Redirect URLs)
Após o domínio funcionar, atualize via Management API ou Dashboard:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/lkxnngzgmyfqgbbpmjvc/config/auth" \
  -H "Authorization: Bearer SEU_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://app.onwaytech.com.br",
    "uri_allow_list": "https://app.onwaytech.com.br/**,https://on-way-condominio.vercel.app/**,http://localhost:5173/**"
  }'
```

## 5. (Opcional) Redirect do domínio antigo
No Vercel Settings → Domains, deixe `on-way-condominio.vercel.app` ativo e configure
redirect 301 para `app.onwaytech.com.br` se quiser preservar links antigos.

## 6. Atualize as referências hardcoded
Procure por `on-way-condominio.vercel.app` no código (existem em algumas Edge Functions
como fallback de `redirectTo`). Mudar para `app.onwaytech.com.br`.

```bash
grep -rn "on-way-condominio.vercel.app" supabase/ src/
```
