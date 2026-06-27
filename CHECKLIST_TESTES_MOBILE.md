# Checklist de Testes Mobile — OnWay Condomínio

> Versão: 2026-06-26
> Dispositivos de referência: iPhone 14 (375×812 / iOS 17), Galaxy S23 (360×800 / Android 14), iPad Mini (768×1024)
> Testar em Chrome Mobile, Safari iOS e Samsung Browser. Usar DevTools "Responsive Mode" para simular quando não houver device físico.

---

## 1. Layout e Navegação Base

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 1.1 | Header visível com logo e nome do condo | 375px | Sem overflow, logo reduzido (28px), truncado com "..." se longo | |
| 1.2 | Bottom nav com 5 ícones + badge de notificação | 375px | Fixo no rodapé, backdrop blur, ícones com ≥44px de toque | |
| 1.3 | Bottom nav não sobrepõe o conteúdo | 375px | Última linha de qualquer formulário scrollável acima da nav | |
| 1.4 | Menu lateral (sidebar) ausente em mobile | 375px | Sidebar nunca aparece em breakpoints < md | |
| 1.5 | Item "Mais" no bottom nav abre launcher | 375px | Launcher mostra todas as rotas disponíveis para o role | |
| 1.6 | Troca de página via launcher | 375px | Navegação instantânea, sem reload | |
| 1.7 | Voltar com gesto do sistema (Android back) | Android | Volta para a página anterior sem bugou dupla navegação | |
| 1.8 | Orientação landscape (375×667) | iPhone SE | Layout não quebra, bottom nav ainda visível | |
| 1.9 | Scroll bounce do iOS não causa glitch | Safari iOS | Fundo escuro (slate-950) preenche bounce area | |

---

## 2. Touch Targets e Interações de Toque

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 2.1 | Botão primário (size md) tem ≥40px de altura | 375px | Altura visível ≥40px em mobile (h-11 = 44px) | |
| 2.2 | Botão small (size sm) tem ≥36px de altura | 375px | h-9 = 36px no breakpoint mobile | |
| 2.3 | Links de texto têm área de toque mínima | 375px | Área clicável perceptível; não escorregar entre links | |
| 2.4 | Tabs do Painel (Tudo/Ocorrências/Multas/Chamados) | 375px | Cada tab clicável com dedo, sem precisar de precisão | |
| 2.5 | Cards do Kanban clicáveis com polegar | 375px | Área de toque >44px de altura por card | |
| 2.6 | Botão de câmera 📷 em EncomendaNova | 375px | Ícone com padding suficiente; toque preciso não necessário | |
| 2.7 | Toggle de feature flags em /configuracoes | 375px | Switch tem ≥44px de área de toque | |
| 2.8 | Ícone ✕ de remoção de gestor em /gestores | 375px | Toque detectado mesmo com dedo largo | |

---

## 3. Formulários em Mobile

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 3.1 | Teclado numérico abre para campos de número | iOS / Android | `inputMode="numeric"` ou `type="number"` ativa teclado numérico | |
| 3.2 | Teclado fecha ao submeter formulário | iOS | Formulário submetido com sucesso; teclado recolhe | |
| 3.3 | Scroll com teclado aberto (formulário longo) | 375px | Campos nunca ficam escondidos atrás do teclado | |
| 3.4 | Labels acima dos inputs (não placeholder) | 375px | Label visível mesmo com teclado aberto | |
| 3.5 | Campo de texto longo (textarea descrição) | 375px | textarea é scrollável sem sair do formulário | |
| 3.6 | Select nativo abre picker iOS/Android | iOS / Android | Sistema abre drum picker / bottom sheet nativo | |
| 3.7 | Upload de foto de ocorrência | iOS | Permite escolher câmera ou galeria | |
| 3.8 | ChamadoNovo completo em 375px | 375px | Todos os campos acessíveis com scroll; nada cortado | |
| 3.9 | EncomendaNova completo em 375px | 375px | Botão salvar acessível após scroll | |

---

## 4. Kanban em Mobile

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 4.1 | Tabs de coluna aparecem apenas em mobile | 375px | Botões "Entrada / Em análise / Pré-envio / Em curso / Encerrados" visíveis | |
| 4.2 | Tabs de coluna scrolláveis horizontalmente | 375px | Deslizar horizontalmente revela todos os 5 nomes | |
| 4.3 | Apenas 1 coluna exibida por vez em mobile | 375px | Colunas não selecionadas ficam ocultas (hidden md:flex) | |
| 4.4 | Badge de contagem na tab ativa | 375px | Número de cards aparece ao lado do nome da coluna | |
| 4.5 | Tabs de coluna some em tablet (md+) | 768px | Seletor de coluna oculto; grid 2 ou 5 colunas aparece | |
| 4.6 | Cards da coluna selecionada scrolláveis | 375px | Lista de cards rola verticalmente sem bug | |
| 4.7 | Clicar no card abre detalhe | 375px | Navegação para /ocorrencias/:id funciona | |
| 4.8 | Botão de avanço rápido em card | 375px | Botão acessível sem arrastar (sem drag-and-drop em touch) | |
| 4.9 | Tabs do filtro de tipo (Tudo/Ocorrências…) | 375px | Scrollável; não sobrepõe tabs de coluna | |

---

## 5. Scanner de Código de Barras

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 5.1 | Botão 📷 aparece no campo de código | 375px | Ícone visível e clicável ao lado do input | |
| 5.2 | Solicita permissão de câmera | iOS / Android | Dialog do sistema aparece na primeira vez | |
| 5.3 | Câmera traseira ativada por padrão | iOS / Android | `facingMode: 'environment'` — câmera do fundo da câmera | |
| 5.4 | Escanear EAN-13 de caixa de encomenda | Android Chrome | Código detectado em < 3 segundos, preenchido no campo | |
| 5.5 | Fallback manual quando câmera é negada | 375px | Input de texto aparece automaticamente | |
| 5.6 | Fechar scanner sem ler código | 375px | Campo fica vazio; sem erro | |
| 5.7 | Scanner em landscape | 375×667 | Câmera não trava; área de scan visível | |
| 5.8 | iOS 16.4+ com BarcodeDetector | Safari iOS 16.4+ | API nativa funciona (não cai no fallback) | |

---

## 6. Assinatura de Entrega (Canvas)

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 6.1 | Canvas aparece ao clicar "Registrar retirada" | 375px | Modal/seção com canvas 480×180 visível | |
| 6.2 | Traço sai exatamente onde o dedo toca | 375px | Sem offset entre dedo e traço (getPos com scale correction) | |
| 6.3 | Traço contínuo ao arrastar o dedo | 375px | Sem pontos isolados, linha fluida | |
| 6.4 | Botão "Confirmar" habilitado após primeiro traço | 375px | Desabilitado no início, habilita após 1 toque | |
| 6.5 | Botão "Limpar" redefine o canvas | 375px | Canvas fica branco/transparente | |
| 6.6 | Zoom da página não quebra o offset do traço | 375px | Sem pinch-to-zoom durante assinatura (canvas full-width) | |
| 6.7 | Canvas em landscape | 375×667 | Canvas adapta largura; não transborda | |
| 6.8 | Salvar assinatura faz upload | 375px | `dataURL` enviado ao Storage; `assinatura_url` salva na encomenda | |

---

## 7. Autenticação e Sessão em Mobile

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 7.1 | Login com teclado virtual | 375px | Campos de e-mail e senha acessíveis; sem sobreposição | |
| 7.2 | Magic link abre app no mobile | iOS / Android | Link do e-mail abre no browser correto e autentica | |
| 7.3 | Sessão persiste ao fechar e reabrir o app | iOS / Android | Não pede login novamente (dentro do timeout de 30min) | |
| 7.4 | Token renovado em background | iOS | App usa a sessão sem piscar tela de login | |

---

## 8. Notificações Push

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 8.1 | Solicitar permissão de notificação | iOS / Android | Dialog do sistema aparece; usuário autoriza | |
| 8.2 | Push chega quando app está em background | Android | Notificação na barra de status | |
| 8.3 | Toque na notificação abre o item correto | Android | Deep link abre a ocorrência/multa/chamado | |
| 8.4 | Push em iOS via Web Push (iOS 16.4+) | Safari iOS 16.4+ | Notificação recebida em background | |

---

## 9. Performance Mobile

| # | Cenário | Ferramenta | Meta | OK? |
|---|---------|-----------|------|-----|
| 9.1 | First Contentful Paint em 4G simulado | Lighthouse Mobile | < 3s | |
| 9.2 | Largest Contentful Paint | Lighthouse Mobile | < 5s | |
| 9.3 | Cumulative Layout Shift | Lighthouse Mobile | < 0.1 (sem pulo de layout) | |
| 9.4 | Total Blocking Time | Lighthouse Mobile | < 300ms | |
| 9.5 | Troca de rota (lazy loading) | Network tab | < 800ms após primeiro carregamento | |
| 9.6 | Scroll suave em lista longa (/ocorrencias) | 375px | 60 fps sem travamento | |
| 9.7 | Imagens em galeria de ocorrência otimizadas | 375px | Não carregam em full res (usar Supabase image transform) | |

---

## 10. Compatibilidade de Browsers Mobile

| # | Cenário | Browser | Resultado esperado | OK? |
|---|---------|---------|-------------------|-----|
| 10.1 | App funciona em Safari iOS 16+ | Safari iOS | Sem erros de CSS/JS; layout correto | |
| 10.2 | App funciona em Chrome Android | Chrome 120+ | Funcionalidade completa incluindo BarcodeDetector | |
| 10.3 | App funciona em Samsung Browser | Samsung 24+ | Sem regressões de layout | |
| 10.4 | Service Worker registrado | Chrome Android | Ativo em DevTools > Application > Service Workers | |
| 10.5 | App instalável como PWA (Add to Home Screen) | Chrome Android | Prompt de instalação aparece ou opção no menu do browser | |
| 10.6 | Ícone do PWA correto na home screen | iOS / Android | Logo OnWay exibida corretamente | |

---

## 11. Acessibilidade Mobile

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 11.1 | VoiceOver (iOS) lê labels dos campos | iPhone | Campos com aria-label ou label associado | |
| 11.2 | TalkBack (Android) navega pelos botões | Android | Foco segue ordem lógica; botões nomeados | |
| 11.3 | Contraste de texto legível em sol direto | 375px | Ratio ≥ 4.5:1 para texto normal | |
| 11.4 | Fonte não diminui por preferências do sistema | iOS | Texto não encolhe ao escolher "Tamanho de Texto" menor | |
| 11.5 | Modo dark do sistema respeitado | iOS / Android | App já é dark-first; consistente com preferência do OS | |

---

## 12. Edge Cases Específicos de Mobile

| # | Cenário | Device | Resultado esperado | OK? |
|---|---------|--------|--------------------|-----|
| 12.1 | Modo avião durante operação | 375px | Mensagem de erro amigável; dados não corrompidos | |
| 12.2 | Conexão lenta (3G) | DevTools throttle | App carrega com skeleton/loading; sem timeout sem feedback | |
| 12.3 | Retry automático após reconexão | 375px | Edge Function retenta até 3x com backoff; usuário não vê falha transiente | |
| 12.4 | Upload de foto grande (10MB+) | 375px | Progresso visível; erro claro se ultrapassar o limite | |
| 12.5 | Copiar link de convite em mobile | 375px | Botão "Copiar link" funciona via Clipboard API | |
| 12.6 | Tela de boas-vindas em novos devices | 375px | Primeiro acesso mostra onboarding (se implementado) | |
| 12.7 | Safe areas iPhone (notch + home bar) | iPhone 14 | Conteúdo não sobrepõe notch ou home indicator | |
| 12.8 | Banner demo não ocupa mais de 1 linha | 375px | Banner âmbar compacto, não empurra conteúdo para baixo | |

---

*Última atualização: 2026-06-26*
