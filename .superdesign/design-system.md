# Gril | Mesa operacional

## Leitura do produto

Dashboard B2B de operação imobiliária para dono e gestor. A tela inicial deve responder em poucos segundos “como está a operação?”, “em que etapa estão os leads?” e “qual é o próximo compromisso?”. Termos de infraestrutura, homologação, RLS e hardening não podem dominar a primeira dobra.

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

1. Cabeçalho mínimo com “Visão geral” e seletor de período. Não usar saudação, eyebrow ou o rótulo “Hoje na operação”.
2. Primeira faixa com quatro métricas essenciais: novos leads, taxa de resposta, agendamentos e conversão. Cada valor deve ser real, explicar seu denominador e assumir “N/D” quando não houver base suficiente.
3. Área dominante com snapshot do Kanban comercial real, seguindo a ordem das etapas ativas. Cada coluna mostra a contagem total e no máximo dois leads; a visão completa continua na rota de Kanban.
4. Kanban rola horizontalmente dentro do próprio painel. A página não pode ganhar overflow lateral, inclusive no mobile.
5. “Precisa de atenção” e “Agenda” são contextos secundários e exibem no máximo três itens acionáveis cada.
6. Estado do Pedro e quantidade de pessoas ativas aparecem numa linha operacional discreta.
7. Limpeza HML permanece fora da hierarquia principal, recolhida numa área administrativa visível apenas para quem já possui a permissão correspondente.

## Gramática visual

- Usar espaço, alinhamento e divisores para hierarquia; cartões apenas quando houver agrupamento real.
- Uma composição métrica e horizontal no desktop, com o Kanban ocupando toda a largura e os contextos operacionais abaixo.
- Linhas interativas com alvo confortável, foco visível e ação explícita; não depender só de cor.
- Números tabulares. Badges apenas para estado real. Ícones Lucide já instalados.
- Mobile preserva as quatro métricas em grade compacta, o Kanban com rolagem interna e os contextos em sequência; sem tabela comprimida nem overflow da página.
- Estados vazios, erro parcial e carregamento devem preservar a hierarquia e orientar recuperação.

## Restrições de produto

- Não inventar dados, alertas ou ações.
- Não alterar rotas, contratos, nomes de campos, server actions, RLS ou gates de papel.
- Manter Server Components para leitura e paralelizar consultas independentes.
- Relatórios entram como resumo acionável na visão geral, não como um novo mosaico de gráficos.
- Conversas é a entrada única para Inbox e Leads, com duas visualizações internas. As rotas continuam preservadas para compatibilidade e links profundos.
- Kanban não aparece na navegação principal; a visão completa é aberta apenas pelo resumo da Visão geral.
- Central reúne Pedro, Lionel e eventos operacionais em uma lista cronológica de dez itens por página. Auditoria usa trinta itens por página.
- Campanhas preserva o modo operacional e os gates do Pedro, mas não apresenta edição de personalidade ou persona.
- Aprendizados, Experimentos A/B, pré-lead Meta, Checklists comerciais e Privacidade não devem orientar a nova navegação.
