# Checklist de Testes — OnWay Condomínio (Web)

> Versão: 2026-06-26 | Ambiente: https://onway-condominio.vercel.app
> Executar em Chrome (desktop) e Firefox. Repetir fluxos críticos em Safari.

---

## 1. Autenticação e Sessão

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 1.1 | Login com e-mail e senha válidos | Qualquer | Redireciona para /dashboard ou /painel | |
| 1.2 | Login com magic link (e-mail) | Qualquer | Link chega no e-mail, clica e entra autenticado | |
| 1.3 | Senha errada 5 vezes consecutivas | Qualquer | Conta bloqueada temporariamente | |
| 1.4 | URL direta `/multas` sem login | Anônimo | Redireciona para /entrar | |
| 1.5 | Sessão idle por 30 minutos | Qualquer | Desconecta e exige re-login | |
| 1.6 | Configuração de 2FA (TOTP) | admin_onway | QR code gerado, app autenticador funciona | |
| 1.7 | Login com 2FA configurado | admin_onway | Solicita código TOTP após senha | |
| 1.8 | Esqueci a senha (reset por e-mail) | Qualquer | E-mail chega, link válido, senha redefinida | |
| 1.9 | Logout encerra sessão | Qualquer | Token inválido, nova visita exige login | |

---

## 2. Roles e Controle de Acesso

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 2.1 | Morador tenta acessar /condominios | morador | Redireciona para / | |
| 2.2 | Portaria tenta acessar /multas | portaria | Redireciona para / | |
| 2.3 | Ronda tenta acessar /comunicados | ronda | Redireciona para / | |
| 2.4 | Conselheiro acessa /painel | conselheiro | Vê cards, sem botão de avanço rápido | |
| 2.5 | Subsíndico acessa /ocorrencias | subsindico | Lista ocorrências do próprio condo | |
| 2.6 | Síndico acessa /planos | sindico | Vê planos em modo leitura, sem botão "Contratar" | |
| 2.7 | admin_onway acessa todos os condos | admin_onway | CondominioSwitcher lista todos | |
| 2.8 | Parceiro acessa multi-condo | parceiro | Vê apenas os condos vinculados | |
| 2.9 | Morador vê apenas SUAS multas | morador | Não aparece multas de outras unidades | |
| 2.10 | Morador vê apenas SEUS chamados | morador | Não aparece chamados abertos por outros | |

---

## 3. Condomínios e Gestão de Usuários

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 3.1 | Criar novo condomínio | admin_onway | Condomínio aparece na lista; logo opcional | |
| 3.2 | Editar condomínio (limiar de aprovação) | admin_onway | Campo `limiar_aprovacao_chamado` salvo corretamente | |
| 3.3 | Ativar modo demo em condomínio | admin_onway | Banner âmbar aparece para todos os usuários do condo | |
| 3.4 | Convidar síndico via /gestores | sindico | Convite criado; link de aceite funciona; role = sindico | |
| 3.5 | Convidar portaria via /gestores | sindico | Role correto, portaria vê apenas menu de portaria | |
| 3.6 | Múltiplos síndicos no mesmo condo | sindico | 2 perfis com role=sindico coexistem, ambos com acesso | |
| 3.7 | Vincular usuário existente por e-mail | admin_onway | Campo e-mail em /gestores, role selecionado, vínculo criado | |
| 3.8 | Remover acesso de gestor | sindico | Botão ✕ na lista; gestor não consegue mais logar no condo | |
| 3.9 | CondominioSwitcher (parceiro) | parceiro | Dropdown troca o condo sem reload completo | |
| 3.10 | Convite expirado | Qualquer | Mensagem de convite inválido ou expirado | |

---

## 4. Ocorrências

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 4.1 | Registrar ocorrência com foto | portaria / ronda | Ocorrência criada, foto upload OK, aparece em /painel coluna Entrada | |
| 4.2 | Registrar ocorrência sem foto | Qualquer com acesso | Funciona sem foto | |
| 4.3 | Avançar ocorrência para Em análise | sindico | Card move para coluna correta no Kanban | |
| 4.4 | Arquivar ocorrência | sindico | Status = arquivada, sai do kanban ativo | |
| 4.5 | Morador registra ocorrência | morador | Criado com `reportado_por = uid`, aparece na lista do morador | |
| 4.6 | Morador tenta editar ocorrência criada | morador | Botão editar ausente ou bloqueado | |
| 4.7 | Filtro por tipo no Painel (só ocorrências) | sindico | Multas e chamados somem do kanban | |
| 4.8 | IA analisa ocorrência | sindico | Botão "Analisar com IA" retorna análise com artigo do regimento | |

---

## 5. Multas

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 5.1 | Criar multa manualmente | sindico | Status inicial = `pendente_aprovacao` | |
| 5.2 | Síndico tenta aprovar multa que ele mesmo criou (SoD) | sindico | Botão desabilitado; mensagem "você criou esta multa" | |
| 5.3 | Outro gestor aprova a multa | administradora | Status muda para `aplicada` | |
| 5.4 | Widget N2 mostra pendente no Painel | administradora | Card "💰 Multa — descrição" aparece no widget de aprovações | |
| 5.5 | Morador contesta multa | morador | Campo de contestação salvo; status = `contestada` | |
| 5.6 | Morador paga multa (confirma) | morador | Status = `paga` | |
| 5.7 | Multa paga some do widget de pendências | Qualquer gestor | Widget N2 atualiza corretamente | |
| 5.8 | Filtro por status na lista de multas | sindico | Apenas multas com o status selecionado aparecem | |

---

## 6. Chamados de Manutenção

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 6.1 | Abrir chamado sem custo estimado | morador | Status = `aberto`, sem fluxo de aprovação | |
| 6.2 | Abrir chamado com custo acima do limiar (R$500) | morador | Status = `pendente_aprovacao` | |
| 6.3 | Abrir chamado com custo abaixo do limiar | morador | Status = `aberto` direto | |
| 6.4 | Síndico aprova chamado de custo alto | sindico | Status muda para `em_andamento` | |
| 6.5 | Widget N2 mostra chamado pendente | sindico | Card "🛠 Chamado — título" no widget | |
| 6.6 | Portaria avança chamado para resolvido | portaria | Status = `resolvido` | |
| 6.7 | Síndico finaliza chamado resolvido | sindico | Status = `finalizado`, some do kanban ativo | |
| 6.8 | Limiar customizado por condo | admin_onway | Condo com limiar R$200 requer aprovação acima de R$200 | |

---

## 7. Encomendas e Portaria

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 7.1 | Registrar encomenda com código de rastreio (digitado) | portaria | Encomenda criada com código salvo | |
| 7.2 | Registrar encomenda sem código | portaria | Funciona sem código de rastreio | |
| 7.3 | Morador retira encomenda (assinatura com mouse) | portaria | Canvas aparece, assinatura salva, status = retirada | |
| 7.4 | Morador retira encomenda (assinatura touch — mouse em desktop) | portaria | Traço segue o cursor sem offset | |
| 7.5 | Limpar canvas de assinatura | portaria | Canvas volta em branco | |
| 7.6 | Filtrar encomendas por status (pendente / retirada) | portaria | Lista filtra corretamente | |
| 7.7 | Morador vê histórico das próprias encomendas | morador | Lista só encomendas da unidade do morador | |

---

## 8. Comunicados, Mural e Notificações

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 8.1 | Publicar comunicado para todos os moradores | sindico | Aparece no Mural de todos os usuários do condo | |
| 8.2 | Publicar comunicado para grupo específico (bloco) | sindico | Apenas moradores do bloco veem | |
| 8.3 | Morador marca comunicado como lido | morador | Badge de não-lido some | |
| 8.4 | Notificação in-app aparece no sino | Qualquer | Badge no NotificationBell, item na lista | |
| 8.5 | Clicar na notificação abre o item | Qualquer | Redireciona para o detalhe correto | |
| 8.6 | Marcar todas notificações como lidas | Qualquer | Badge zera | |

---

## 9. Assembleias e Votações

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 9.1 | Criar assembleia com pauta | sindico | Aparece em /assembleias | |
| 9.2 | Criar votação vinculada à assembleia | sindico | Votação listada com opções | |
| 9.3 | Morador vota | morador | Voto registrado; não pode votar duas vezes | |
| 9.4 | Morador tenta votar duas vezes | morador | Mensagem de erro ou botão desabilitado | |
| 9.5 | Síndico encerra votação e vê resultado | sindico | Contagem exibida por opção | |
| 9.6 | Fazer upload da ATA | sindico | PDF enviado ao Storage, link disponível na tela | |

---

## 10. Chat Interno

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 10.1 | Morador envia mensagem para portaria | morador | Mensagem aparece em tempo real (Realtime) | |
| 10.2 | Portaria responde | portaria | Resposta aparece no chat do morador | |
| 10.3 | Mensagem de grupo (condomínio) | sindico | Todos os usuários do condo veem | |
| 10.4 | Chat com IA (WayON) | Qualquer | Resposta da IA aparece; contexto do condo presente | |
| 10.5 | Upload de imagem no chat | Qualquer | Imagem aparece inline na conversa | |

---

## 11. Relatórios

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 11.1 | Gerar PDF de multas do período | sindico | PDF abre no browser / download automático | |
| 11.2 | Gerar CSV de ocorrências | sindico | Arquivo `.csv` abre em Excel com caracteres acentuados corretos (BOM UTF-8) | |
| 11.3 | Aplicar template "Multas do mês" | sindico | Campos de data preenchidos automaticamente | |
| 11.4 | Relatório sem resultados no período | sindico | Mensagem "Nenhum item encontrado" em vez de PDF vazio | |
| 11.5 | Exportar CSV de chamados | sindico | Linhas com status, categoria, data, responsável | |

---

## 12. Planos e Billing

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 12.1 | Síndico acessa /planos | sindico | Página carrega, planos visíveis, sem botão "Contratar" | |
| 12.2 | admin_onway clica em "Contratar" | admin_onway | Redireciona para Stripe Checkout | |
| 12.3 | Concluir pagamento no Stripe (teste) | admin_onway | Redireciona para /checkout/sucesso | |
| 12.4 | Cancelar pagamento no Stripe | admin_onway | Redireciona para /planos sem erro | |
| 12.5 | Banner de trial mostra data de expiração | Qualquer | Data correta do campo `trial_ends_at` | |
| 12.6 | Retry em falha de rede no checkout | admin_onway | Tenta 2x antes de mostrar erro | |

---

## 13. Feature Flags e Configurações

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 13.1 | Síndico desativa módulo "Classificados" | sindico | Link "Classificados" some do nav | |
| 13.2 | Reativar módulo desativado | sindico | Link retorna ao nav | |
| 13.3 | Flag global desativada pelo admin_onway | admin_onway | Mensagem "Desabilitado globalmente pela OnWay" na tela de config do condo | |
| 13.4 | Módulo desativado bloqueia URL direta | morador | /classificados redireciona para / | |

---

## 14. Campos Customizados

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 14.1 | Criar campo customizado para ocorrências | sindico | Campo aparece no formulário de nova ocorrência | |
| 14.2 | Campo obrigatório sem preenchimento | Qualquer | Formulário não submete, erro inline | |
| 14.3 | Deletar campo customizado | sindico | Campo some dos formulários (dados históricos preservados em `campos_extras`) | |

---

## 15. Auditoria e Segurança

| # | Cenário | Usuário | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 15.1 | Ação de gestor registrada no audit log | sindico | Entrada em /auditoria com timestamp e detalhe da ação | |
| 15.2 | Usuário de outro condo não vê dados deste condo | Qualquer | RLS bloqueia — resposta vazia | |
| 15.3 | Token expirado não acessa API | Qualquer | 401 / redireciona para login | |
| 15.4 | Chave de API não aparece no bundle JS | — | `grep -r "sk_" dist/` retorna vazio | |

---

## 16. Performance e Qualidade Geral

| # | Cenário | Ferramenta | Meta | OK? |
|---|---------|-----------|------|-----|
| 16.1 | First Contentful Paint | Lighthouse | < 2.5s em conexão 4G simulada | |
| 16.2 | Largest Contentful Paint | Lighthouse | < 4s | |
| 16.3 | JavaScript bundle size | Network tab | < 500 KB gzipped | |
| 16.4 | Lazy loading de rotas | Network tab | Rotas pesadas carregadas sob demanda | |
| 16.5 | Sem erros de console em fluxo normal | DevTools | Zero erros vermelhos | |

---

*Última atualização: 2026-06-26*
