# Interface system

## Direção

Central imobiliária editorial para donos, gestores e corretores que precisam localizar pendências e agir em segundos. A interface combina a precisão de uma mesa de operações com a materialidade de um dossiê de imóvel: papel mineral, tinta grafite, marcações terracota, confirmação verde e referências discretas a plantas arquitetônicas.

O produto deve transmitir controle calmo, leitura rápida e confiança. Não deve parecer landing page, dashboard genérico de IA ou coleção de cards idênticos.

## Assinatura

O **pulso operacional** é uma linha curta terracota usada em estados ativos, itens prioritários, sugestões do Pedro e pontos de decisão. Ela aparece na navegação ativa, em chamadas de atenção e nas superfícies que exigem ação. Nunca é meramente decorativa.

## Tokens

- Parchment / canvas: `#f3f1eb`
- Paper / surface: `#fbfaf7`
- Paper raised: `#fffefa`
- Ledger / surface muted: `#e9e5dc`
- Ledger strong: `#d8d2c7`
- Charcoal / ink: `#1c211f`
- Charcoal soft: `#4d5551`
- Charcoal muted: `#747b76`
- Clay / accent: `#bd572c`
- Clay dark: `#913e1d`
- Pine / positive: `#28624f`
- Blueprint / contextual: `#506873`
- Amber / warning: `#9a671d`
- Redline / danger: `#a33d36`
- Radius: 8px em controles, 12px em blocos internos, 16px em painéis e 22px em superfícies de destaque.
- Spacing: base de 4px; valores principais 4, 8, 12, 16, 20, 24, 32, 40 e 48px.

## Tipografia

- Interface: Manrope, corpo base 14px.
- Display: Newsreader apenas em marca, títulos de página e momentos editoriais.
- Escala operacional: caption 9–10px, metadata 11px, body 13–14px, section 16–18px, page title 30–38px.
- Hierarquia usa primeiro peso e cor; tamanho vem depois.
- Números operacionais sempre usam `font-variant-numeric: tabular-nums`.

## Profundidade

Superfícies claras com sombra em três camadas quase imperceptível. Bordas são reservadas a controles, divisores e contêineres que precisam de limite explícito. Inputs são levemente mais escuros que a superfície ao redor para parecerem áreas de entrada.

Sem gradientes, glassmorphism, sombras dramáticas ou pilhas de cards flutuantes. Blur é permitido apenas na navegação móvel fixa para preservar legibilidade sobre conteúdo.

## Hierarquia e densidade

- Uma ação ou conjunto de dados focal por tela.
- Cabeçalhos de páginas operacionais usam título de 30–38px, descrição curta e ações à direita.
- Painéis operacionais: 16–20px de padding; listas densas: 12–16px.
- Métricas não devem formar automaticamente uma grade de cards; preferir faixas, divisões internas ou uma métrica dominante com secundárias.
- Grupos relacionados ficam próximos; seções diferentes recebem pelo menos 24px.

## Componentes

- Botão primário: 42px de altura, fundo charcoal ou clay conforme o nível de atenção, radius 8px, fonte 12px/750.
- Botão secundário: 42px, paper raised, borda suave, radius 8px.
- Inputs e selects: mínimo 42px, `control-bg`, borda suave e foco clay de 3px.
- Painel: paper raised, radius 16px, sombra sutil; divisores internos usam `border-soft`.
- Status: ponto + texto ou badge curto; cor sempre acompanhada de conteúdo textual.
- Tabelas: uma única superfície, headers 9–10px em caixa alta e linhas de 44px ou mais.
- Empty state: título objetivo, explicação de uma frase e ação quando aplicável; nunca apenas um ícone solto.
- Modal: `dialog` nativo, radius 16px, backdrop grafite translúcido, entrada de até 220ms.

### Navegação

- Sidebar de 248px no mesmo canvas da aplicação, separada por borda suave.
- Item ativo em charcoal com pulso terracota à esquerda.
- Links agrupados por Atendimento, Operação, Inteligência e Administração.
- Em mobile, dock de cinco itens com menu “Mais”; nenhuma rota essencial depende de scroll horizontal.

### Badge de notificações do Inbox

- Uso: sinaliza pendências que exigem atenção sem competir com o nome do contato ou com a navegação.
- Semântica: na sidebar e na navegação móvel, conta conversas com pelo menos uma pendência; na linha da conversa, conta mensagens novas do lead mais sugestões pendentes da IA.
- Estado: não renderizar quando o total for zero. Abrir a conversa limpa apenas as mensagens novas; sugestões permanecem até aprovação ou descarte.
- Visual: fundo clay, borda clay dark e texto branco; pílula de 20px, mínimo de 20px, padding horizontal de 6px e fonte 10px/800. No mobile, 18px e fonte 9px.
- Acessibilidade: nome acessível com quantidade e tipo das pendências; cor nunca comunica o estado sozinha.
- Movimento: nenhum; atualização imediata e discreta.

## Responsividade

Desktop prioriza varredura horizontal e painéis lado a lado quando existe relação clara. Abaixo de 1050px, painéis auxiliares empilham. Abaixo de 820px, sidebar vira header e dock inferior. Abaixo de 680px, formulários e métricas usam uma coluna. Nenhuma ação essencial depende de hover.

## Movimento

- Botões: feedback de pressão em `scale(.98)` por 120ms.
- Menus e diálogos: opacity + transform, 160–220ms, `cubic-bezier(0.23, 1, 0.32, 1)`.
- Nenhuma animação em ações repetidas de atendimento.
- `prefers-reduced-motion` remove deslocamentos e reduz transições.
