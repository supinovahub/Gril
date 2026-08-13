# Plano de refatoração UI/UX e arquitetura do Gril

**Status:** auditoria concluída e implementação incremental iniciada na branch
`agent/ui-architecture-audit`; as decisões bloqueadoras que alteram backend,
papéis ou remoção física continuam aguardando aprovação específica.
**Princípio:** commits pequenos, cada um compilável, testável e reversível.
**Base:** diagnóstico em [`AUDITORIA_UI_UX_ARQUITETURA.md`](./AUDITORIA_UI_UX_ARQUITETURA.md).

## Objetivo do plano

Transformar a interface em um produto de operação comercial orientado ao corretor e à imobiliária, com uma unidade mental única — Conversas — sem quebrar APIs, workers, RLS, filas, integrações ou contratos de backend.

O plano prioriza a leitura e a navegação. Mutations existentes só serão alteradas quando o fluxo novo exigir uma correção comprovada; o primeiro ciclo não cria tabelas nem remove dados.

## Regras de execução

- uma fase pequena por commit ou conjunto mínimo de commits relacionados;
- cada commit deve passar por `npm test`, `npm run lint` e `npm run build` na proporção do risco;
- nenhum migration em paralelo; qualquer migration deve ter plano, review, `migration list`, lint, validação local/remota e rollback;
- aliases mantêm rotas antigas durante a transição;
- toda mudança material cria registro independente em `docs/agent/changes/`;
- uma decisão de produto conflitante interrompe a implementação daquela parte, não é resolvida por inferência;
- não registrar tokens, segredos, dados pessoais ou transcrições de homologação nos commits.

## Fases pequenas

### Fase 0 — Fechar contrato de produto e baseline

**Objetivo:** transformar as decisões da reunião em definições implementáveis.

**Entregas:**

- decisão sobre `/app/conversas` e aliases de Inbox/Leads/Kanban/Agenda;
- definição de `atenção`, `lead hoje`, `em andamento`, `agendamento` e `conversão`, incluindo fuso e timestamp;
- mapeamento de Atendimento/Reativação para os estados atuais de IA;
- confirmação de que Corretor/Imobiliária são personas ou novos papéis;
- classificação de Aprendizados, A/B, pré-lead, checklist e Privacidade;
- contrato de eventos do Log Center versus auditoria de segurança;
- fixture sintética de dados para testar atenção, paginação e dashboard.

**Backend:** nenhum.
**Validação:** revisão de produto, segurança e operações; `git diff --check`.
**Rollback:** remover somente documentos de decisão não publicados.

### Fase 1 — Design system mínimo

**Objetivo:** criar a linguagem visual que as próximas telas vão compartilhar.

**Entregas:**

- completar tokens de tipografia, spacing, raio, borda, foco, estados e motion;
- corrigir `--radius-sm` ou substituir seu uso por token oficial;
- primitives para `Button`, `IconButton`, `Badge`, `Card`, `PageHeader`, `Tabs`, `DataTable`, `FormField`, `EmptyState`, `LoadingState`, `ErrorState` e `ConfirmDialog`;
- estados hover, focus-visible, disabled, loading, erro e sucesso com contraste testável;
- vocabulário visual para status comerciais e técnicos.

**Arquivos principais:** `src/app/globals.css`, `src/components`, CSS Modules compartilhados.
**Backend:** nenhum.
**Validação:** test fixtures, lint, build e revisão em desktop/mobile; sem alterar regra de negócio.
**Rollback:** manter páginas antigas usando CSS Modules até cada tela adotar as primitives.

### Fase 2 — Shell, capabilities e navegação compatível

**Objetivo:** fazer a navegação apontar para objetivos do usuário, não para tabelas.

**Entregas:**

- separar catálogo de navegação, capabilities e labels do App Shell;
- adicionar entrada canônica `Conversas`;
- definir aliases/redirects para `/app/inbox`, `/app/leads`, `/app/kanban`, `/app/agenda`, `/app/hoje` e `/app/meu-pipeline`;
- ajustar navegação mobile para Conversas;
- mover Administração e diagnósticos técnicos para agrupamento de baixa prioridade;
- manter Chat com Pedro como deep link contextual, não como segunda Inbox;
- decidir o destino visual de Lionel, Aprendizados e Experimentos sem remover o backend.

**Arquivos principais:** `src/components/app-shell`, `src/lib/routing`, novas rotas/redirects em `src/app/app`.
**Backend:** nenhum.
**Validação:** matriz de permissão por papel, links antigos, back button, mobile, guia de homologação e build de todas as rotas.

### Fase 3 — Query layer e performance do Inbox

**Objetivo:** reduzir latência percebida sem mudar comportamento de mensagens, IA ou takeover.

**Entregas:**

- extrair consultas nomeadas para lista, badge, detalhe e contexto;
- trocar janela fixa de 100 por cursor estável, preservando atenção antes da atividade;
- limitar badges à rota/superfície necessária ou criar resumo barato por usuário;
- medir/substituir a agregação de `inbox_notification_counts` após EXPLAIN com RLS;
- projetar colunas explicitamente e carregar histórico por blocos/paginação;
- deduplicar refresh de marcador de leitura e Realtime;
- validar índice de ordenação antes de migration.

**Arquivos principais:** `src/app/app/layout.tsx`, `src/app/app/inbox/**`, `src/lib/inbox`, `src/components/app-shell/realtime-refresh.tsx`, views/índices se aprovados.
**Backend:** inicialmente nenhum; migration/RPC somente após plano medido.
**Validação:** p50/p95/p99, query count, payload, attention-outside-first-page, unread/pending, concorrência e guia do Inbox.

### Fase 4 — Conversas como unidade de trabalho

**Objetivo:** consolidar lead, histórico, IA, tarefas, calls e status comercial no contexto da conversa.

**Entregas:**

- lista com views `Todos`, `Não respondidos`, `Em andamento`, `Agendados`, `Convertidos`, `Arquivados`;
- filtros por responsável, origem, estágio e período;
- detalhe em três regiões: lista, conversa e contexto;
- tabs/contextos para resumo, qualificação, tarefa/follow-up, agenda, ownership, estágio e auditoria;
- atalhos para a oportunidade e calendário, sem duplicar o registro;
- Chat com Pedro exibindo a mesma sugestão/contexto transacional do Inbox;
- aliases para deep links antigos.

**Arquivos principais:** nova composição de `src/app/app/conversas`, `src/app/app/inbox`, `src/app/app/leads/[id]`, `src/app/app/agenda`, `src/components`.
**Backend:** preservar actions e contratos; apenas read-models novos se necessário.
**Validação:** todos os estados conversacionais, takeover, aprovação/edição/descartar de IA, arquivo/restauração, calls e escopo de corretor.

### Fase 5 — Dashboard orientado à operação

**Objetivo:** responder o que o usuário precisa fazer agora.

**Hierarquia:**

1. atenção imediata;
2. operação do dia;
3. cinco indicadores resumidos;
4. atividade recente.

**Entregas:**

- card principal de conversas que exigem atenção com link filtrado;
- leads recebidos hoje;
- atendimentos em andamento;
- agendamentos do período;
- conversões do período;
- resumo de atividade recente;
- diagnósticos de homologação e limpeza HML apenas para quem tem permissão, em área secundária.

**Arquivos principais:** `src/app/app/page.tsx`, `dashboard.module.css`, query layer de CRM/calls/conversations.
**Backend:** consultas agregadas; sem alterar entidades.
**Validação:** definição de cada KPI, fuso da operação, vazio, erro, permissão, comparação com relatórios existentes.

### Fase 6 — Log Center unificado

**Objetivo:** tornar a operação observável em um fluxo legível.

**Entregas:**

- página com 10 entradas por página;
- paginação por cursor ou página estável;
- filtros IA, Campanhas, Integrações, Sistema, Erros e Usuário;
- linha com horário, origem, tipo, descrição, status e ação relacionada;
- agrupamento visual opcional por dia, sem perder ordenação;
- link para conversa, campanha, integração ou execução de origem;
- estado de erro/retentativa e empty state;
- badge no shell sem transformar todo evento em interrupção.

**Arquivos principais:** `src/app/app/central`, `operations.module.css`, `src/lib` de eventos e novos componentes de log.
**Backend:** usar eventos existentes; criar view/RPC apenas se o contrato de leitura não existir.
**Validação:** 10/11/100 eventos, filtros combinados, permissões, links, Realtime e ausência de segredo em descrição.

### Fase 7 — Campanhas em cinco passos

**Objetivo:** reduzir decisões visíveis e manter o backend de reativação.

**Fluxo:**

1. selecionar lista;
2. definir mensagem;
3. configurar IA;
4. revisar;
5. disparar.

**Entregas:**

- wizard com progresso, resumo persistente e saída segura;
- validação de consentimento, opt-out, duplicidade e placeholders na etapa certa;
- preview por amostra sem expor joins internos;
- revisão de ondas 20/50/restante conforme regra atual, sem revisão individual removida;
- detalhe com status, pausa, retomada e histórico;
- reutilização das actions e workers existentes.

**Arquivos principais:** `src/app/app/campanhas`, `src/lib/campaigns`, primitives de formulário.
**Backend:** nenhum contrato quebrado; agregação server-side se necessário.
**Validação:** CSV sintético, personalização, opt-out, hash, preview/persistência, ondas, pause/resume e auditoria.

### Fase 8 — IA por contexto

**Objetivo:** tornar inequívoco onde a IA atua e em que nível de autonomia.

**Entregas:**

- área Atendimento para inbound/WhatsApp;
- área Reativação para campanhas/base existente;
- produção, revisão/observação e allowlist apresentados conforme a decisão de produto;
- configurações avançadas sob disclosure, com explicação de impacto;
- Simulador preservado e explicitamente sem efeitos reais;
- links de execução/sugestão para conversa e Log Center.

**Arquivos principais:** `src/app/app/pedro`, `src/app/app/simulador`, `src/lib/ai`, campanha e decisões de produção.
**Backend:** preservar gates server-side; nenhum botão pode liberar um modo não permitido pelo runtime.
**Validação:** shadow/assisted, production-only reactivation, allowlist, edição de sugestão, conflito de versão, opt-out e simulador.

### Fase 9 — Equipe e onboarding

**Objetivo:** simplificar a linguagem sem enfraquecer autorização.

**Entregas:**

- onboarding com dois caminhos visíveis: Corretor e Imobiliária;
- resumo simples de acesso e operação;
- owner/manager/broker mantidos como camada de autorização interna até decisão de migração;
- equipe com convite, WhatsApp obrigatório, operação e disponibilidade em progressão;
- ações administrativas perigosas em seções secundárias e confirmadas.

**Arquivos principais:** cadastro, onboarding, equipe, auth, invitations, documentação de segurança.
**Backend:** preservar RLS, convites, aprovação, ownership e audit.
**Validação:** três caminhos de cadastro, convite, WhatsApp, escopo de corretor, suporte, suspensão e API direta.

### Fase 10 — Relatórios integrados e auditoria legível

**Objetivo:** pôr informação no lugar correto sem perder profundidade.

**Entregas:**

- métricas de decisão no dashboard;
- relatório detalhado acessível por contexto quando necessário;
- auditoria com 30 itens por página;
- filtros eficientes, cursor/paginação e colunas legíveis;
- metadata em expansão/drawer, com modo bruto para suporte;
- preservação de eventos imutáveis e retenção.

**Arquivos principais:** `src/app/app/relatorios`, `src/app/app/configuracoes/auditoria`, RPCs/views/índices aprovados.
**Backend:** somente read-models e índices justificados.
**Validação:** métricas comparadas, 30/31/250 eventos, filtros, permissões e exportação quando aplicável.

### Fase 11 — Descontinuação controlada

**Objetivo:** retirar superfícies que forem aprovadas, sem apagar capacidades necessárias.

**Entregas condicionais:**

- remover da navegação principal;
- redirecionar links antigos;
- preservar backend, dados e audit enquanto houver dependência;
- executar migração somente com decisão registrada;
- atualizar mapa de telas, backlog, homologação e CURRENT_STATE quando a funcionalidade realmente mudar.

**Não iniciar antes de:** decisão sobre Aprendizados/A-B, pré-lead, checklist e Privacidade; matriz de impacto e confirmação de que não há requisito de segurança/homologação pendente.

### Fase 12 — Hardening, acessibilidade e homologação

**Objetivo:** provar o fluxo completo.

**Entregas:**

- revisão visual desktop/mobile e notebook baixo;
- foco por teclado, contraste, labels, live regions e reduced motion;
- medição p95 das rotas críticas;
- testes de erro, vazio, permissão, concorrência e retry;
- execução do `GUIA_COMPLETO_DE_HOMOLOGACAO.md` com contas/dados autorizados;
- documentação de riscos residuais e rollback.

**Validação mínima:** `npm test`, `npm run lint`, `npm run build`, smoke browser autenticado, Supabase migration list/advisors e verificação da rota pública/deploy quando houver publicação autorizada.

## Wireframes textuais de baixa fidelidade

Estes wireframes são a referência de baixa fidelidade do redesenho. As
primeiras superfícies já foram implementadas parcialmente; eles não substituem
a aprovação do contrato de produto nem a homologação visual autenticada.

### Dashboard

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Bom dia, [nome]                              [período] [operação]     │
├──────────────────────────────────────────────────────────────────────┤
│ ATENÇÃO AGORA                                                       │
│ [ 12 conversas exigem atenção ]  [Ver conversas]                    │
├──────────────────────────────────────────────────────────────────────┤
│ Hoje                                                                 │
│ [Leads hoje] [Em andamento] [Agendamentos] [Conversões]              │
├───────────────────────────────────────┬──────────────────────────────┤
│ Próximas ações                         │ Atividade recente            │
│ • responder Ana                        │ 10:42 mensagem recebida      │
│ • confirmar visita João                │ 10:31 call agendada           │
│ • revisar sugestão Pedro              │ 09:58 lead convertido          │
└───────────────────────────────────────┴──────────────────────────────┘
```

### Conversas

```text
┌───────────────┬──────────────────────────┬───────────────────────────┐
│ Views         │ Conversa                 │ Contexto                  │
│ Todos         │ Ana Souza                │ Lead / oportunidade       │
│ Não respond.  │ [não lida] Quero visitar │ Qualificação              │
│ Em andamento  │ João Lima                │ Próxima tarefa             │
│ Agendados     │ Pedro Costa              │ Agendamento                │
│ Convertidos   │ ...                      │ IA / sugestão              │
│ Arquivados    │                          │ Histórico / auditoria      │
├───────────────┴──────────────────────────┴───────────────────────────┤
│ [Responder] [Assumir] [Agendar] [Pedir ajuda ao Pedro]              │
└──────────────────────────────────────────────────────────────────────┘
```

### Central de Operações / Log Center

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Log Center                         [IA] [Campanhas] [Erros] [Filtros]│
├──────────┬──────────────┬──────────────┬────────────────┬────────────┤
│ Horário  │ Origem       │ Tipo         │ Descrição      │ Status     │
│ 10:42    │ IA / Pedro   │ Sugestão     │ Resposta pronta│ Revisão    │
│ 10:31    │ Campanha     │ Onda         │ 20 contatos    │ Liberada   │
│ 10:10    │ Integração   │ WhatsApp     │ Conexão ativa  │ OK         │
│ ...      │              │              │                │            │
├──────────────────────────────────────────────────────────────────────┤
│ Mostrando 1–10 de ...                         [Anterior] [Próxima]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Campanhas

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Nova campanha                                      Etapa 2 de 5      │
│ Lista ━━━ Mensagem ━━━ IA ━━━ Revisão ━━━ Disparo                  │
├──────────────────────────────────────────────────────────────────────┤
│ Escolha a mensagem                                                   │
│ [Mensagem principal..............................................]  │
│ Variáveis disponíveis: nome · objetivo · entrada · parcela           │
│ Preview: “Oi, Ana...”                                                │
│                                                                      │
│ [Voltar]                                             [Continuar]     │
└──────────────────────────────────────────────────────────────────────┘
```

### IA

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Pedro IA                                                             │
│ [Atendimento]                                      [Reativação]     │
├──────────────────────────────────────────────────────────────────────┤
│ Estado atual: Revisão                                               │
│ O que acontece: Pedro sugere respostas; uma pessoa aprova o envio.  │
│                                                                      │
│ Produção / revisão                                                  │
│ [Desligado] [Observação] [Revisão]                                  │
│                                                                      │
│ [Abrir simulador]                              [Salvar configuração] │
└──────────────────────────────────────────────────────────────────────┘
```

### Equipes

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Equipe                                                              │
│ [Corretor] [Imobiliária]                                            │
├──────────────────────────────┬───────────────────────────────────────┤
│ Pessoas                      │ Convites / acesso                     │
│ Ana — corretora — ativa      │ [Convidar pessoa]                      │
│ João — corretor — pendente   │ WhatsApp obrigatório · operação        │
│                              │ Permissões avançadas (administração)   │
└──────────────────────────────┴───────────────────────────────────────┘
```

## Sequência sugerida de commits

1. `docs(ux): registrar auditoria e plano de refatoração`
2. `refactor(ui): adicionar primitives e tokens do design system`
3. `refactor(nav): introduzir Conversas e aliases compatíveis`
4. `perf(inbox): extrair query layer e paginação da lista`
5. `feat(conversas): consolidar views e contexto da conversa`
6. `feat(dashboard): substituir métricas técnicas por operação do dia`
7. `feat(operations): criar Log Center paginado e filtrável`
8. `refactor(campaigns): implementar wizard de cinco passos`
9. `refactor(ai): separar Atendimento e Reativação`
10. `refactor(team): simplificar onboarding preservando papéis internos`
11. `feat(audit): paginar logs em 30 itens e melhorar filtros`
12. `chore(verification): executar homologação e registrar riscos`

O commit de documentação contém este plano, a auditoria e o primeiro registro
em `docs/agent/changes/`. A implementação desta branch limita-se a mudanças de
leitura, navegação e apresentação compatíveis; qualquer migration, alteração de
RLS, mudança de papel ou remoção física continua condicionada às decisões da
Fase 0.

### Estado desta branch

- Concluído: primitives mínimas, shell com Conversas, Dashboard orientado à
  operação, Central/Log Center, Auditoria visual, wizard de Campanhas, IA por
  Atendimento/Reativação, alias paginado do Inbox e apresentação inicial dos
  modelos de Equipe.
- Pendente: read model/paginação de banco do Inbox e Log Center, aliases
  contextuais para Leads/Agenda/Kanban, onboarding completo, integração
  profunda de Relatórios, remoção controlada de módulos e homologação visual
  autenticada.

## Critério de pronto da refatoração

- o corretor encontra e resolve uma conversa sem escolher entre Inbox, Lead, Kanban e Agenda;
- o dashboard mostra atenção e operação do dia sem expor infraestrutura como métrica principal;
- Log Center mostra 10 eventos por página, filtra e leva à ação de origem;
- campanhas seguem cinco passos e mantêm regras de consentimento, opt-out e ondas;
- IA deixa claro Atendimento versus Reativação e não libera modo proibido no servidor;
- equipe simplifica onboarding sem remover autorização/RLS;
- auditoria mostra 30 itens, pagina, filtra e preserva metadata;
- Inbox tem medição antes/depois, paginação, badges eficientes e nenhum efeito funcional alterado;
- design system cobre estados principais e é usado pelas seis telas redesenhadas;
- test, lint, build e homologação passam, com riscos residuais documentados.
