# Auditoria UI/UX e arquitetura do Gril

**Fase:** 1 — diagnóstico, sem implementação
**Data da auditoria:** 13/08/2026
**Base analisada:** `origin/phase/01-foundation` (`57bab0749279`)
**Worktree:** `agent/ui-architecture-audit`
**Escopo:** aplicação Next.js, camadas de domínio e integrações, Supabase remoto, navegação, carregamento do Inbox e padrões visuais.

## Resumo executivo

O Gril já possui fundamentos de produção que devem ser preservados: banco como fonte canônica, RLS, ações de servidor com validação de organização e versão, idempotência, filas, estados conversacionais explícitos, separação entre conectores e domínio, e uma base visual própria. O problema principal não é falta de backend; é a forma como a aplicação transforma esse backend em superfícies concorrentes para a mesma jornada.

Hoje a interface apresenta a operação por recortes técnicos: Inbox, Leads, Kanban, Agenda, Hoje, Meu pipeline, Chat com Pedro, Lionel, Central, Relatórios e várias páginas administrativas. Isso obriga o usuário a decidir qual módulo contém a próxima ação. A arquitetura desejada deve ser uma simplificação de apresentação sobre as entidades existentes, não uma reescrita do modelo de dados.

Os pontos de maior prioridade são:

1. criar uma superfície única de **Conversas**, com views para atenção, andamento, agenda, conversão e arquivo;
2. trocar o dashboard técnico por uma visão de atenção e operação diária;
3. separar o **Log Center** dos alertas e das filas contextuais, mantendo links para o registro de origem;
4. reduzir campanhas e IA a fluxos orientados por decisão, sem remover contratos de backend;
5. tratar o carregamento do Inbox como um problema de leitura, paginação e revalidação, não como motivo para alterar o fluxo transacional;
6. consolidar primitives do design system antes de refazer cada tela;
7. resolver explicitamente os conflitos de produto documentados antes de remover módulos.

Não foi implementada alteração de código nesta fase.

## Como a auditoria foi feita

Foram usados:

- leitura de `docs/agent/CURRENT_STATE.md`, `docs/agent/README.md`, registros recentes de `docs/agent/changes/`, documentos de produto, decisões e operações;
- inventário de `src/app`, `src/components` e `src/lib`;
- leitura dos fluxos de App Shell, dashboard, Central, Inbox, conversa, campanhas, Pedro, equipe, relatórios e auditoria;
- inspeção do fluxo de homologação e da rastreabilidade comportamental do Pedro;
- `git status`, `git fetch origin` e worktree isolado a partir de `origin/phase/01-foundation`;
- consulta somente leitura ao Supabase remoto `frslhzwhaooqtivkzdez`, incluindo migration list, metadados de tabelas/índices, definição de `inbox_notification_counts`, planos representativos e advisors de performance;
- baseline local com `npm test`, `npm run lint` e `npm run build`.

Limitações: a base remota observada é pequena e os `EXPLAIN ANALYZE` foram executados com uma consulta representativa, não como um trace autenticado de uma sessão de usuário. Portanto, os riscos de escala abaixo são evidências estruturais e não uma afirmação de que o ambiente atual já esteja saturado.

## Inventário arquitetural

| Camada | Local principal | Responsabilidade atual | Diagnóstico |
|---|---|---|---|
| Rotas de produto | `src/app/app/**` | Server Components, carregamento de dados e composição da tela | Muitas rotas são fatias de uma mesma jornada e agregam dados diretamente no page component. |
| Mutations | `src/app/app/**/actions.ts` | Server Actions para CRM, Inbox, campanhas, equipe e IA | Há boas validações e compatibilidade, mas a experiência de leitura não possui a mesma camada de composição. |
| Shell | `src/components/app-shell` | Navegação, permissões, badges e refresh realtime | Um componente concentra decisões de produto, labels, hierarquia e autorização de visibilidade. |
| Domínio | `src/lib/domain`, `src/lib/crm`, `src/lib/inbox`, `src/lib/campaigns`, `src/lib/calls` | Regras e funções especializadas | Existe separação útil, porém queries de view-model continuam espalhadas pelas rotas. |
| Provedores | `src/lib/whatsapp`, `src/lib/ai`, `src/lib/integrations`, `src/lib/webhooks` | Conectores e execução assíncrona | A separação deve ser mantida; a UI não deve expor os detalhes por padrão. |
| Persistência | `supabase/migrations`, RLS e views | Estado canônico, segurança, filas, auditoria e eventos | É a principal fundação a preservar. O redesenho inicial pode ser feito sem quebrar APIs ou tabelas. |
| Estilos | `src/app/globals.css` e 24 CSS Modules | Tokens, páginas e componentes locais | Há tokens úteis, mas ainda não há um kit de componentes de produto suficientemente reutilizado. |

O inventário encontrou 41 arquivos `page.tsx`, 27 arquivos de actions e 24 CSS Modules no escopo da aplicação. O build gera 46 rotas incluindo páginas públicas e APIs. A quantidade não é, por si só, um defeito; o problema é que várias dessas rotas são percebidas como destinos de negócio independentes.

## 1. Problemas encontrados

### A1 — Navegação divide uma entidade em vários destinos

**Evidência:** o App Shell expõe Atendimento, Inbox, Leads, Agenda, Kanban, Hoje, Meu pipeline e páginas relacionadas. O mapa de telas de produto já declara que Inbox, Kanban e Agenda são views das mesmas entidades, mas a implementação ainda mantém a separação visual.

**Impacto:**

- o corretor precisa escolher entre lista de mensagens, lead, pipeline e agenda para agir sobre o mesmo cliente;
- filtros, badges e estados podem parecer inconsistentes entre telas;
- o custo de suporte e homologação cresce porque a mesma jornada tem várias portas de entrada;
- a navegação móvel substitui a entrada principal por `Leads`, sem uma superfície equivalente a Conversas.

**Estratégia:** introduzir uma superfície `/app/conversas` como composição de leitura, com views `Todos`, `Não respondidos`, `Em andamento`, `Agendados`, `Convertidos` e `Arquivados`. Manter `/app/inbox`, `/app/leads`, `/app/kanban` e `/app/agenda` como aliases ou destinos contextuais durante a transição, sem apagar APIs nem dados.

**Prioridade:** P0 de experiência, P1 técnico.
**Módulos:** `src/components/app-shell`, `src/app/app/inbox`, `src/app/app/leads`, `src/app/app/kanban`, `src/app/app/agenda`, `src/app/app/hoje`, `src/app/app/meu-pipeline`, `src/lib/routing`.

### A2 — Assistência do Pedro aparece como produto paralelo à conversa

**Evidência:** `/app/chat-pedro`, `/app/lionel` e `/app/assistente-corretor` usam o workspace de chat interno, enquanto o Inbox é a fonte da conversa externa. A decisão `chat-pedro-assisted-queue` define o Chat com Pedro como fila contextual de sugestões, não como uma segunda conversa com o lead.

**Impacto:** o usuário pode interpretar sugestões, mensagens internas e mensagens WhatsApp como entidades equivalentes; a atenção fica fragmentada; ações precisam ser conferidas em dois lugares.

**Estratégia:** dentro de Conversas, exibir o contexto de IA e a fila de sugestões da conversa selecionada. O Log Center receberá eventos de IA e ações automáticas com link para a conversa. O Chat com Pedro pode continuar como entrada contextual e rota compatível para os cenários atuais, mas não deve competir com a conversa externa.

**Risco:** remover a fila interna diretamente quebraria cenários de revisão, intervenção humana e homologação. O contrato atual exige que a sugestão seja a mesma no Inbox e no Chat com Pedro.

**Prioridade:** P0 de navegação, P0 de segurança operacional.
**Módulos:** `src/app/app/chat-pedro`, `src/app/app/lionel`, `src/app/app/assistente-corretor`, `src/components/internal-chat`, `src/lib/internal-chat`, `src/app/app/inbox`.

### A3 — Dashboard responde sobre infraestrutura, não sobre o dia do usuário

**Evidência:** `src/app/app/page.tsx` apresenta `Operações visíveis`, `Pessoas ativas`, `Pendentes / convites`, gate do piloto e limpeza de homologação. São dados úteis para administração, mas não são a hierarquia principal de um corretor.

**Impacto:** a primeira tela não responde o que exige atenção; capacidade, convites e controles técnicos competem com a jornada comercial; administradores e corretores recebem a mesma composição visual.

**Estratégia:** criar um view-model de dashboard com cinco métricas de negócio: conversas que exigem atenção, leads recebidos hoje, atendimentos em andamento, agendamentos e conversões. Ordem visual: atenção imediata, operação do dia, indicadores resumidos e atividade recente. Gate de piloto, limpeza HML e saúde técnica ficam em superfícies administrativas com permissão.

**Pendência de definição:** “hoje”, “conversão” e “em andamento” precisam ser definidos pelo fuso da operação e por eventos canônicos antes da implementação.

**Prioridade:** P0 de UX, P1 de dados.
**Módulos:** `src/app/app/page.tsx`, `src/app/app/dashboard.module.css`, `src/app/app/relatorios`, consultas de `conversations`, `opportunities`, `calls`, `campaign_contacts` e `audit` quando aplicável.

### A4 — Central mistura alertas, capacidade, integrações, campanhas e notificações

**Evidência:** `src/app/app/central/page.tsx` faz sete consultas paralelas e mostra alertas, notificações, escaladas, calls, campanhas, saúde de integrações e stop conditions. Não é um fluxo de logs paginado e também não é uma fila simples de atenção.

**Impacto:** origem e gravidade ficam misturadas; o usuário precisa interpretar termos como capacidade, stop condition e health check; a tela tende a crescer por adição de painéis.

**Estratégia:** criar Log Center como stream unificado de eventos de operação com origem, tipo, descrição, status e ação relacionada. Carregar inicialmente 10 registros por página, com paginação e filtros `IA`, `Campanhas`, `Integrações`, `Sistema`, `Erros` e `Usuário`. Alertas críticos continuam com tratamento próprio e linkam para o evento; não devem ser reduzidos a texto de log.

**Prioridade:** P1.
**Módulos:** `src/app/app/central`, `src/app/app/operations.module.css`, `src/lib` de alerts, campaigns, integrations, AI e audit, além de `src/components/app-shell` para badge e deep link.

### A5 — Campanhas têm uma página monolítica e agregação em memória

**Evidência:** `src/app/app/campanhas/page.tsx` carrega campanhas, conexões, contatos de campanha, imports, issues, waves e templates em paralelo. Depois filtra arrays em memória por campanha. A criação apresenta nome, conexão, template, modo IA, três aberturas, consentimento, origem e outros campos na mesma superfície.

**Impacto:** o usuário vê decisões técnicas antes de decidir a mensagem; o custo de renderização e transferência cresce com a base; o fluxo não corresponde aos cinco passos desejados; a composição pode recalcular `campaignContacts.filter`, imports, issues e waves repetidamente.

**Estratégia:** manter ações, workers e tabelas existentes; separar criação em cinco etapas: lista, mensagem, IA, revisão e disparo. Criar view-models por etapa e uma página de detalhe da campanha. A consulta deve carregar apenas o conjunto necessário para a etapa atual e, se o volume justificar, usar agregação no servidor e paginação por campanha.

**Prioridade:** P1 de UX e performance.
**Módulos:** `src/app/app/campanhas/page.tsx`, `src/app/app/campanhas/actions.ts`, `src/app/app/campanhas/campaigns.module.css`, `src/lib/campaigns`, tabelas de imports, rows, contacts, waves e templates.

### A6 — Configuração de IA expõe detalhes de implementação

**Evidência:** `/app/pedro` concentra persona, drafts, exemplos, chave, modelo principal/fallback, orçamento, limites, modos inbound/reactivation, allowlist, execução e parâmetros avançados. A documentação atual separa atendimento, reativação, simulator e curadoria, mas a UI ainda é uma página extensa.

**Impacto:** o usuário não sabe qual configuração controla atendimento versus reativação; produção, shadow, assisted, allowlist, modelo e fallback aparecem no mesmo nível; uma configuração técnica pode ser alterada sem a intenção comercial estar clara.

**Estratégia:** duas áreas primárias independentes: `Atendimento` para leads recebidos e `Reativação` para campanhas sobre base existente. Expor primeiro apenas estado de produção e revisão/observação relevantes ao usuário; deixar versões, modelos e credenciais em controles progressivos com linguagem clara. Manter o Simulador como ferramenta isolada e sem efeitos reais.

**Conflito a resolver:** a decisão atual de produção restringe inbound normal a `off`, `shadow` e `assisted`, enquanto reativação pode operar em `production` com teste controlado. “Produção” e “Revisão” não podem ser mapeados para os mesmos estados sem confirmar a intenção de produto.

**Prioridade:** P1 de UX e P0 de segurança operacional.
**Módulos:** `src/app/app/pedro`, `src/app/app/simulador`, `src/lib/ai`, `src/lib/campaigns`, `docs/decisions/reactivation-production-only.md`.

### A7 — “Corretor” e “Imobiliária” conflitam com o modelo interno de papéis

**Evidência:** o produto e a homologação usam owner, manager e broker para autorização, operação e escopo. O pedido de redesenho define apenas os modelos principais Corretor e Imobiliária, mas não esclarece se isso substitui papéis de acesso ou apenas simplifica onboarding.

**Impacto:** remover owner/manager/broker sem substituição pode abrir acesso indevido, quebrar aprovação de equipe, alterar RLS percebido e destruir fluxos de suporte/propriedade.

**Estratégia:** tratar `Corretor` e `Imobiliária` como personas de cadastro/onboarding até decisão contrária. Mapear internamente Corretor para broker e Imobiliária para organização, preservando owner/manager como papéis administrativos invisíveis no fluxo principal. Só migrar papéis depois de uma decisão de autorização, RLS, convite e suporte.

**Prioridade:** P0 de segurança e produto.
**Módulos:** `src/app/cadastro`, `src/app/onboarding`, `src/app/app/equipe`, `src/lib/auth`, `src/lib/invitations`, RLS e documentação de segurança.

### A8 — Pedido de remoção de módulos contradiz o produto e a homologação atuais

**Evidência:** `learning_suggestions`, Lionel, experimentos e variantes A/B aparecem no modelo de dados, na especificação, no backlog e na homologação. Formulários Meta/pré-lead, checklists comerciais e privacidade também possuem fluxos documentados; privacidade inclui acesso, exportação, correção, anonimização e legal hold.

**Impacto:** remover código ou tabelas agora pode apagar trilha de auditoria, controles jurídicos, testes de regressão ou contratos do backend. Apenas esconder uma rota sem decidir o destino da permissão também cria inconsistência.

**Estratégia:** não remover nesta fase. Classificar cada item em `retirar da navegação`, `manter em Administração`, `manter como ferramenta interna` ou `descontinuar com migração`. A remoção de Aprendizados/A-B e a exclusão de pré-lead/checklist/privacy exigem decisão de produto e revisão de segurança antes de qualquer deleção.

**Prioridade:** bloqueador de decisão.
**Módulos:** `src/app/app/aprendizados`, `src/app/app/pedro/experimentos`, `src/app/app/lionel`, `src/app/app/configuracoes/privacidade`, `src/app/app/configuracoes/checklists`, Meta forms, `supabase/migrations`, auditoria e homologação.

### A9 — Relatórios são uma seção paralela com consultas largas

**Evidência:** `src/app/app/relatorios/page.tsx` carrega oportunidades, contatos de campanha, calls, resultados, execuções de IA, uso, capacidade e settings em paralelo e agrega grande parte em JavaScript.

**Impacto:** o usuário encontra indicadores fora do dashboard; dados que deveriam ser resumidos são carregados por completo; filtros e períodos podem ficar inconsistentes; métricas financeiras e operacionais podem ter custo alto.

**Estratégia:** mover os indicadores de decisão para o dashboard através de queries de resumo com período/fuso explícitos. Manter uma visão detalhada para auditoria/gestão quando necessária, mas sem competir na navegação primária. Evitar remover os dados de origem; trocar `select *` por projeções e agregações.

**Prioridade:** P1.
**Módulos:** `src/app/app/relatorios`, `src/app/app/page.tsx`, `src/lib` de CRM/campaigns/calls/AI e eventuais views SQL.

### A10 — Auditoria de logs não oferece a escala operacional pedida

**Evidência:** `src/app/app/configuracoes/auditoria/page.tsx` chama `list_audit_events` com `p_limit: 250`, sem paginação de produto e sem filtros eficientes visíveis. A renderização exibe metadata JSON em tabela genérica.

**Impacto:** leitura ruim, payload desnecessário, dificuldade de localizar ator/origem/ação e risco de uma consulta crescer sem limite útil.

**Estratégia:** adicionar paginação de 30 itens, filtros por horário, ator, ação, origem/status e busca controlada. Preferir cursor estável ou página baseada em índice, com ordenação por `created_at desc, id desc`. Exibir metadata em drawer/expansão legível e manter payload bruto para inspeção.

**Prioridade:** P1.
**Módulos:** `src/app/app/configuracoes/auditoria`, RPC/view de auditoria, índices e `src/app/app/operations.module.css`.

### A11 — Inbox tem riscos estruturais de latência e excesso de revalidação

**Fluxo atual observado:**

1. O layout autenticado chama `requireActiveViewer` e, em todas as rotas autenticadas, faz em paralelo `loadInboxNotificationCounts` e `loadInternalChatNotifications`.
2. A lista do Inbox busca até 100 conversas ordenadas por `updated_at desc` e faz uma segunda consulta quando há pendências fora dessa janela.
3. A view `inbox_notification_counts` agrega mensagens inbound e sugestões pendentes por conversa, com `count(distinct ...)`, e só depois a aplicação filtra `total_count > 0`.
4. O detalhe carrega conversa, até 300 mensagens, resumo, sugestões pendentes e configuração de IA em cinco consultas paralelas.
5. O marcador de leitura pode chamar `router.refresh()`; o Realtime também chama `router.refresh()` para eventos mapeados, com debounce de 300 ms.

**Impacto:**

- cada navegação autenticada paga consultas de badges mesmo fora do Inbox;
- a view de notificações tem custo proporcional ao conjunto agregado, não apenas às conversas com atenção;
- a ordenação por `updated_at` não corresponde ao índice `conversations_inbox_idx`, que prioriza `last_inbound_at`/`started_at`;
- a janela de 100 exige consulta complementar e não é paginação real;
- `select *` e 300 mensagens ampliam payload e renderização no detalhe;
- revalidar a rota inteira é seguro como fallback, mas pode refazer várias queries a cada evento.

**O que já está correto:** a ordenação coloca atenção antes de atividade recente; o realtime foi tornado orientado a eventos, com visibilidade da aba e debounce, substituindo polling periódico. A otimização deve evoluir esse trabalho, não reintroduzir polling ou alterar o contrato de aprovação/envio.

**Estratégia:** criar uma camada de query/view-model do Inbox; usar paginação por cursor com chave estável; medir e substituir a view de contagem por existência/contagem pré-agregada por usuário quando necessário; alinhar índice à ordenação final após validar o plano; carregar detalhe em blocos; limitar eventos realtime à superfície afetada e evitar refresh redundante após marcar leitura.

**Prioridade:** P0 de performance percebida, P0 de segurança funcional (não alterar os guardrails).
**Módulos:** `src/app/app/layout.tsx`, `src/app/app/inbox/page.tsx`, `src/app/app/inbox/[id]/page.tsx`, `src/app/app/inbox/[id]/conversation-read-marker.tsx`, `src/components/app-shell/realtime-refresh.tsx`, `src/lib/inbox/notifications.ts`, `src/lib/inbox/sorting.ts`, views/índices Supabase.

### A12 — Consultas e view-models estão acoplados à composição das páginas

**Evidência:** rotas como campanhas, Central, Relatórios e detalhe de lead executam várias queries diretamente no `page.tsx` e fazem joins/agregações na camada de apresentação. Há ações com boa validação, mas não há um padrão único para query, estado de carregamento, erro, paginação e view-model.

**Impacto:** refazer a UI tende a duplicar consultas; correções de performance precisam ser repetidas em telas diferentes; `select("*")` aumenta acoplamento ao schema; testes de domínio e de apresentação ficam difíceis de separar.

**Estratégia:** por domínio, criar funções server-only de leitura com projeções nomeadas, filtros tipados e contratos de view-model. Páginas passam a compor layout e estados, não a conhecer joins completos. A camada não deve duplicar regras de autorização: ela reutiliza `requireActiveViewer` e as políticas do banco.

**Prioridade:** P1 técnico.
**Módulos:** `src/app/app/**/page.tsx`, `src/lib/crm`, `src/lib/campaigns`, `src/lib/calls`, `src/lib/ai`, `src/lib/inbox`.

### A13 — Design system tem tokens, mas não tem primitives suficientes

**Evidência:** `globals.css` possui uma paleta consistente e tokens de superfície, borda, sombra, raio e motion. Porém, botões, inputs, badges, tabelas, cards e headers são estilizados repetidamente em cada CSS Module. O Inbox e a Agenda têm blocos posteriores que redefinem os mesmos seletores; `internal-chat-workspace.module.css` usa `var(--radius-sm)`, que não está declarado nos tokens globais.

**Impacto:** pequenas diferenças de raio, altura, peso, foco, disabled e cor se acumulam; ajustes visuais exigem editar várias páginas; tokens inválidos produzem fallback do navegador; acessibilidade e responsividade podem divergir.

**Estratégia:** definir contrato de tokens e primitives compartilhadas para Button, Badge, Card, PageHeader, Tabs, DataTable, FormField, EmptyState, LoadingState, ErrorState e ConfirmDialog. Migrar uma superfície por vez e remover duplicações apenas quando a equivalência visual for comprovada.

**Prioridade:** P1 de consistência.
**Módulos:** `src/app/globals.css`, `src/components`, CSS Modules da aplicação, especialmente Inbox, Agenda, Campanhas, Equipe e operações.

### A14 — Estados de carregamento, erro e vazio não têm contrato transversal

**Evidência:** existe `src/app/app/loading.tsx`, mas cada página compõe seus próprios estados e várias leituras capturam somente `data`, deixando o tratamento de erro dependente do componente ou do fallback. O guia de homologação exige loading/empty/error/permission por fluxo.

**Impacto:** o usuário pode receber uma tela vazia para falha de consulta; mensagens, ações e retry variam por módulo; a percepção de lentidão aumenta porque não há skeleton contextual nem feedback de mutação uniforme.

**Estratégia:** padronizar estados por recurso e por ação, com retry seguro, mensagens humanas e informação técnica apenas para suporte. Incluir critérios de permissão e estado desatualizado no contrato de cada view.

**Prioridade:** P1.
**Módulos:** todas as rotas de produto; primitives em `src/components` e `src/app/app/loading.module.css`.

### A15 — O App Shell concentra regras de navegação, permissões e labels

**Evidência:** `src/components/app-shell/app-shell.tsx` contém grupos, paths, regras de papel/permissão, badges e navegação mobile no mesmo componente. O seletor de operação é visual e não representa troca efetiva de contexto.

**Impacto:** qualquer mudança de produto exige editar um componente grande; uma regra de permissão pode ser confundida com uma regra de navegação; desktop e mobile podem divergir; a operação selecionada pode gerar expectativa que o código não atende.

**Estratégia:** separar catálogo de navegação, capability map, labels e renderizadores de desktop/mobile. A navegação principal deve ser derivada de capacidades e objetivos do usuário. O seletor de operação deve ser removido ou conectado a um contexto real antes de continuar sendo apresentado como controle.

**Prioridade:** P1.
**Módulos:** `src/components/app-shell/app-shell.tsx`, `app-shell.module.css`, `src/lib/auth`, `src/lib/routing`.

### A16 — Responsividade e densidade não seguem a mesma hierarquia

**Evidência:** a sidebar é fixa em 248 px e o Inbox/detalhe possuem layouts densos; a navegação móvel usa Início, Inbox, Leads, Agenda e Mais. Algumas páginas possuem blocos de CSS “refinados” posteriores, com breakpoints próprios.

**Impacto:** mobile não recebe a mesma entidade central; tabelas e painéis podem exigir interpretação horizontal; o usuário perde contexto ao alternar entre lista, conversa e detalhe.

**Estratégia:** definir breakpoints e comportamentos por primitive. Em mobile, Conversas vira uma sequência lista → detalhe → contexto, com filtros persistentes e retorno claro. Testar notebook com pouca altura e zoom de 100%, requisito já presente no guia de homologação.

**Prioridade:** P1 de UX.
**Módulos:** App Shell, Inbox, Agenda, Campanhas, Equipe, Operações e design system.

## 2. Impacto consolidado

| Área | Impacto atual | Severidade | Resultado esperado |
|---|---|---:|---|
| Clareza da jornada | O mesmo lead aparece em vários destinos com vocabulários diferentes. | P0 | Conversa como unidade de trabalho, views sem duplicação mental. |
| Atenção comercial | Dashboard prioriza operação técnica e não próxima ação. | P0 | Primeiro olhar responde o que fazer agora. |
| Segurança operacional | Mudanças de IA, papéis e remoção de módulos podem alterar gates e RLS. | P0 | UI simplificada preservando controles server-side e decisões explícitas. |
| Inbox | Consultas globais, view agregada, janela fixa e revalidação ampla. | P0 | Lista paginada, badges eficientes e detalhe progressivo. |
| Performance de dados | Campanhas/relatórios agregam grandes conjuntos no servidor da página. | P1 | Projeções, filtros, paginação e resumos server-side. |
| Observabilidade | Central e auditoria misturam tipos e escalas diferentes. | P1 | Log Center de 10 por página e auditoria de 30 por página. |
| Consistência visual | Tokens existem, primitives não; CSS tem overrides e duplicações. | P1 | Componentes compartilhados e estados previsíveis. |
| Homologação | Muitos caminhos continuam necessários, mesmo que a navegação seja consolidada. | P1 | Aliases e deep links durante a migração, sem quebrar cenários. |

## 3. Estratégia de correção

### Princípios de arquitetura

1. **Uma fonte de verdade sem uma única página monolítica:** conversa, lead, oportunidade, mensagem, call, tarefa, IA e auditoria continuam entidades distintas no backend; a UI apresenta uma unidade de trabalho com contextos relacionados.
2. **Leitura nova, escrita preservada:** primeiro criar read-models e view-models; manter server actions, workers, eventos, RLS e contratos públicos.
3. **Progressive disclosure:** configuração técnica aparece apenas quando a decisão do usuário exige; não esconder segurança server-side atrás de UI.
4. **URL compatível:** links antigos devem redirecionar ou abrir a view equivalente; favoritos e procedimentos de homologação não podem quebrar durante o rollout.
5. **Medição antes de índice/migration:** qualquer mudança de banco nasce de plano comparável, cardinalidade, RLS e teste de regressão.
6. **Componente antes de acabamento:** consolidar tokens e primitives antes de replicar a nova aparência em seis telas.
7. **Atenção mensurável:** cada badge e KPI deve ter definição, fuso, janela, origem e critério de encerramento.

### Fronteira de preservação do backend

Devem permanecer intactos no primeiro ciclo: tabelas e estados de conversação, RLS, ações de aprovação/envio, filas e jobs, eventos de auditoria, integração WhatsApp/Meta, contratos de campanha, simulador sem efeitos reais e decisões de produção do Pedro. Mudanças de schema só são justificadas por um gargalo medido ou por uma decisão de produto aprovada.

### Decisões que precisam ser confirmadas antes de remover algo

| Tema | Fato atual | Decisão necessária |
|---|---|---|
| Conversas | Inbox, Kanban, Agenda e Leads são vistas relacionadas no produto, mas têm rotas próprias. | Definir `/app/conversas` como entrada canônica e estratégia de aliases. |
| Chat com Pedro | É fila contextual assistida, não conversa externa. | Confirmar sua posição como contexto dentro de Conversas e como deep link. |
| IA | Inbound normal tem `off/shadow/assisted`; reativação tem production controlado. | Definir o significado de Produção/Revisão na nova UI. |
| Equipe | owner/manager/broker sustentam autorização. | Confirmar se Corretor/Imobiliária são personas de onboarding ou substituição de papéis. |
| Aprendizados/A-B | São partes documentadas do MVP e da homologação. | Aprovar retirada da navegação, retenção interna ou descontinuação com migração. |
| Pré-lead/checklist | Há integração Meta e fluxos CRM documentados. | Definir se a remoção é só de UI ou de produto/backend. |
| Privacidade | Há acesso, exportação, correção, anonimização e legal hold. | Manter em Administração salvo decisão jurídica explícita em contrário. |
| Métricas | O dashboard atual usa métricas técnicas. | Definir eventos e janela de cada KPI comercial. |
| Log Center | Central atual é painel misto; auditoria é trilha de segurança. | Confirmar que Log Center e Auditoria permanecem superfícies distintas. |

## 4. Ordem ideal de implementação

1. **Contrato e decisões:** fechar definições de conversa, KPI, IA, papéis e módulos removíveis; registrar decisões.
2. **Design system mínimo:** tokens faltantes, primitives, estados e acessibilidade.
3. **Shell e compatibilidade:** catálogo de navegação, Conversas canônica, aliases, mobile e deep links.
4. **Inbox/Conversas:** query layer, paginação, badges, filtros e contexto progressivo.
5. **Dashboard:** KPIs de negócio, atenção, operação do dia, resumo e atividade recente.
6. **Log Center:** stream unificado, 10 itens por página, filtros e ações relacionadas.
7. **Campanhas:** wizard de cinco passos apoiado no backend atual e detalhe da campanha.
8. **IA:** Atendimento/Reativação separados, revisão/produção contextual e Simulador preservado.
9. **Equipe:** onboarding de Corretor/Imobiliária mapeado aos papéis atuais.
10. **Relatórios e auditoria:** resumos no dashboard; auditoria com 30 itens, cursor e filtros.
11. **Descontinuação controlada:** somente depois das decisões, aliases, migração de dados/links e homologação.
12. **Performance e homologação final:** medir Inbox e rotas críticas com dados autorizados, revisar acessibilidade e executar o guia completo.

## 5. Riscos de regressão

| Risco | Causa provável | Mitigação |
|---|---|---|
| Conversa duplicada ou mensagem enviada fora do estado | Refatoração mistura view-model com mutation. | Manter actions, expected versions, idempotência e testes de concorrência; mudar primeiro só a leitura. |
| Vazamento entre imobiliárias | Novo read-model ignora organização, operação ou RLS. | Reutilizar viewer, filtros de organização e consultas sob RLS; testar acesso direto por API. |
| Pedro atuar no canal errado | UI iguala Atendimento e Reativação. | Mapear modos explicitamente e validar no servidor; manter production-only reactivation. |
| Perda de atenção | Nova paginação não inclui mensagens/sugestões fora da primeira página. | Testes com atividade antiga pendente, cursor estável e ordenação atenção → atividade. |
| Quebra de homologação | Rotas antigas somem ou labels mudam sem deep link. | Aliases, redirects controlados, matriz de rotas e execução do guia antes de remover. |
| Falha jurídica/operacional | Privacidade, opt-out, auditoria ou checklists são ocultados/removidos. | Manter superfícies administrativas e backend até decisão e revisão de segurança. |
| Perda de rastreabilidade | Log Center substitui audit log bruto. | Logs operacionais referenciam eventos; auditoria permanece imutável e separada. |
| Regressão visual | Primitives alteram CSS local sem migração incremental. | Story/fixtures visuais, snapshots manuais e uma tela por commit. |
| Migração desnecessária | Índice/view alterado antes de medir com RLS. | EXPLAIN comparável, advisor, migration review e rollback documentado. |
| Refresh excessivo | Realtime e ações continuam revalidando a árvore inteira. | Instrumentar refresh, limitar eventos por rota e testar aba visível/oculta. |

## 6. Módulos afetados

| Módulo | Tipo de impacto | Observação |
|---|---|---|
| `src/components/app-shell` | Alto | Navegação, badges, permissões visuais, mobile e realtime. |
| `src/app/app/inbox` | Muito alto | Núcleo da nova Conversas e maior risco percebido de performance. |
| `src/lib/inbox` | Alto | Ordenação, notificações, query layer e contratos de leitura. |
| `src/app/app/page.tsx` | Alto | Dashboard e agregações comerciais. |
| `src/app/app/central` | Alto | Log Center, alertas e links para ações. |
| `src/app/app/campanhas` / `src/lib/campaigns` | Alto | Wizard, detalhe e agregação por etapa. |
| `src/app/app/pedro` / `src/lib/ai` | Alto | Separação de contextos e modos autorizados. |
| `src/app/app/equipe` / `src/lib/auth` | Alto | Onboarding, personas e preservação de papéis. |
| `src/app/app/leads`, `kanban`, `agenda`, `hoje`, `meu-pipeline` | Alto | Views/aliases para Conversas e contexto de lead. |
| `src/app/app/relatorios` | Médio/alto | Resumos no dashboard e leitura detalhada opcional. |
| `src/app/app/configuracoes/auditoria` | Médio | Paginação 30, filtros e legibilidade. |
| `src/components/internal-chat` | Médio | Contexto de assistência, sem apagar fila de revisão. |
| `src/app/globals.css`, `src/components`, CSS Modules | Alto | Design system e migração visual incremental. |
| `supabase/migrations`, views e índices | Condicional | Sem alteração na Fase 1; só após medição/decisão. |
| `docs/product`, `docs/decisions`, `docs/operations` | Alto | Atualizar quando uma regra de produto for aprovada, não por hipótese. |

## Auditoria específica do carregamento do Inbox

### Evidências de código

- `src/app/app/layout.tsx` executa badges de Inbox e chat interno em toda rota autenticada.
- `src/app/app/inbox/page.tsx` limita a lista inicial a 100, ordena por `updated_at` e faz uma consulta adicional para pendências fora da janela.
- `src/lib/inbox/notifications.ts` consulta `inbox_notification_counts` e filtra somente depois da agregação da view.
- `src/app/app/inbox/[id]/page.tsx` carrega até 300 mensagens e usa projeções amplas.
- `src/components/app-shell/realtime-refresh.tsx` faz `router.refresh()` por tabela/rota, com debounce e visibilidade da aba.
- `src/app/app/inbox/[id]/conversation-read-marker.tsx` pode revalidar depois de marcar leitura.

### Evidências do Supabase remoto

- PostgreSQL remoto: 17.6.
- Migrations locais/remotas foram comparadas por `--project-ref` e estavam alinhadas até `20260810140144`; o worktree isolado não estava linkado, então `--linked` não pôde ser usado diretamente.
- Snapshot de tabelas públicas relevantes: 83 conversas, 230 mensagens, 31 sugestões de IA, 25 estados de leitura, 83 oportunidades e 83 contatos. Esses números são pequenos e não provam saturação atual.
- `conversations_inbox_idx` cobre `org_id`, `operation_id`, `status` e `coalesce(last_inbound_at, started_at)`, mas não a ordenação atual por `updated_at`.
- A view `inbox_notification_counts` faz joins de mensagens inbound e sugestões pendentes, `count(distinct ...)` e `group by conversation`; o predicado de atenção é aplicado pelo consumidor depois da view.
- Advisors de performance retornaram 461 FKs sem índice e 67 índices sem uso. O resultado é um backlog amplo, não uma autorização para apagar índices nem prova de que todos afetam Inbox.
- Nos planos representativos executados com a base pequena, o custo de execução foi baixo, mas houve scans/agrupamentos compatíveis com o risco estrutural. Os planos não foram usados para declarar uma latência de produção.

### Medição recomendada antes da correção

1. instrumentar tempo de `requireActiveViewer`, layout badges, lista, view de notificações e detalhe separadamente;
2. medir p50/p95/p99, payload, número de queries e refreshes por navegação;
3. comparar lista por offset e cursor com a ordenação de atenção definida;
4. testar com dados sintéticos autorizados em volume representativo, mantendo RLS e fuso;
5. medir eventos realtime por minuto e quantos terminam em refresh sem mudança visível;
6. só então criar migration para índice/view/RPC, com plano antes/depois e rollback.

## Baseline de validação

Executado no worktree isolado, sem alterações de código:

- `npm ci --ignore-scripts`: concluído; npm reportou duas vulnerabilidades de alta severidade no conjunto de dependências, sem correção incidental nesta auditoria;
- `npm test`: 22 arquivos e 110 testes aprovados;
- `npm run lint`: aprovado;
- `npm run build`: aprovado com o `.env.local` local carregado apenas no processo; 46 rotas geradas.

## Conclusão

O redesenho deve começar pela experiência e pela camada de leitura, preservando a arquitetura transacional já construída. A maior simplificação de produto é consolidar a navegação em Conversas e mover a operação técnica para Log Center/Administração, não apagar tabelas ou fluxos sem decisão. A única parte que deve bloquear implementação é a resolução dos conflitos documentados sobre IA, papéis e remoção de funcionalidades.
