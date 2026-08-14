# Gril | Mesa operacional

## Leitura do produto

Dashboard B2B de operação imobiliária para dono e gestor. A tela inicial deve responder em poucos segundos: “o que precisa de mim agora?”, “o que mudou hoje?” e “onde a operação está travando?”. Termos de infraestrutura, homologação, RLS e hardening não podem dominar a primeira dobra.

## Modo e dials

- Redesign preserve: identidade e marca de produção permanecem intactas.
- `DESIGN_VARIANCE: 6`: recomposição estrutural clara, sem espetáculo visual.
- `MOTION_INTENSITY: 2`: feedback de estado e hover apenas.
- `VISUAL_DENSITY: 8`: mesa operacional compacta, escaneável e responsiva.
- Referência de sistema: padrões de informação e task-first do Atlassian Design System, implementados com os componentes e tokens nativos do projeto, sem adicionar dependência.

## Identidade bloqueada

- Canvas `#f3f1eb`; superfícies `#fbfaf7` e `#fffefa`.
- Texto `#1c211f`; secundário `#4d5551`; silencioso `#747b76`.
- Acento único `#bd572c`, com `#913e1d` para contraste.
- Estados: pinho `#28624f`, âmbar `#9a671d`, vermelho `#a33d36`.
- Manrope para interface; Newsreader somente em título de alto nível.
- Favicon P carvão/papel, nome Pedro e metadados atuais não mudam.
- Sem azul-cobalto, gradientes, glassmorphism, dark mode, sombras dramáticas ou nova família tipográfica.

## Arquitetura da tela proposta

1. Cabeçalho curto com saudação, operação atual e uma ação contextual.
2. Área dominante “Precisa de atenção” como fila de trabalho, não como KPI abstrato. Cada linha deve mostrar pessoa, motivo, tempo de espera, responsável e ação.
3. Coluna “Hoje” com agenda e próximos compromissos em sequência temporal compacta.
4. “Pulso comercial” integrado abaixo como faixa analítica: entradas, respostas, reuniões, avanço e conversão com rótulos humanos e links de investigação.
5. Estado do Pedro e capacidade da equipe em uma linha operacional discreta, visível quando houver risco ou decisão.
6. Configuração inicial aparece apenas se realmente incompleta. Limpeza HML permanece fora da hierarquia principal, recolhida numa área administrativa.

## Gramática visual

- Usar espaço, alinhamento e divisores para hierarquia; cartões apenas quando houver agrupamento real.
- Uma composição assimétrica no desktop, com fila principal mais larga e contexto diário mais estreito.
- Linhas interativas com alvo confortável, foco visível e ação explícita; não depender só de cor.
- Números tabulares. Badges apenas para estado real. Ícones Lucide já instalados.
- Mobile vira uma sequência priorizada: atenção, hoje, pulso, contexto; sem tabela comprimida.
- Estados vazios, erro parcial e carregamento devem preservar a hierarquia e orientar recuperação.

## Restrições de produto

- Não inventar dados, alertas ou ações.
- Não alterar rotas, contratos, nomes de campos, server actions, RLS ou gates de papel.
- Manter Server Components para leitura e paralelizar consultas independentes.
- Relatórios entram como resumo acionável na visão geral, não como um novo mosaico de gráficos.
- A consolidação Inbox, Chat, Leads e Agenda é uma direção de arquitetura posterior; este desenho pode antecipar a fonte única por links e linguagem, sem remover rotas neste ciclo.
- Aprendizados, Experimentos A/B, pré-lead Meta, Checklists comerciais e Privacidade não devem orientar a nova navegação.
