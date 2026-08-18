# Estado atual compartilhado do Gril

## Atualização de 18/08/2026 — nova limpeza de contexto operacional

- Um único contexto de homologação solicitado foi removido novamente do Supabase
  canônico `frslhzwhaooqtivkzdez`. O recibo registrou 1 contato, 1 telefone,
  1 oportunidade, 1 conversa, 18 mensagens, 5 anexos, 10 execuções de IA,
  9 sugestões, 192 jobs, 34 eventos de outbox e 5 objetos de Storage.
- A simulação integral com rollback passou antes da execução definitiva. Após o
  commit, contato, telefone, conversa, mensagens, execuções e sinais de IA
  relacionados ficaram em zero; os 5 arquivos de mídia foram removidos pela API
  do Storage e uma verificação posterior confirmou zero objeto residual.
- A auditoria foi preservada e contém o recibo `status=purged`. A whitelist não
  faz parte do expurgo e continua com uma entrada ativa; por isso, uma nova
  mensagem desse número pode recriar um contexto limpo.
- A tabela `ai_feedback_signals`, adicionada depois da rotina protegida de
  limpeza, não é tratada por ela. Dois sinais do alvo precisaram ser removidos
  explicitamente na mesma transação. A rotina publicada deve ser atualizada em
  migration futura para que o botão de limpeza também cubra esse caso.
- Não houve migration, mudança de código ou deploy. Evidência detalhada:
  `docs/agent/changes/2026-08-18-nova-limpeza-contexto-operacional.md`.

## Atualização de 18/08/2026 — production inbound sem três gates operacionais

- O PR #60 foi mergeado na branch canônica `phase/01-foundation` no commit
  `5d76dfe3d6db8e5adc8176a676067ae940c16144`. O dashboard continua mostrando
  **Responde automaticamente** quando há whitelist ativa, sem ativar o modo ao
  cadastrar um telefone.
- A migration `20260818170835_relax_inbound_production_gates.sql` foi aplicada
  e confirmada no Supabase `frslhzwhaooqtivkzdez`. Perfil institucional, health
  check recente/sem erro e regressão aprovada deixaram de bloquear a seleção de
  production; conhecimento, modelos e conexão WhatsApp ativa com inbound
  habilitado permanecem obrigatórios.
- A organização continua em `assisted`, com exatamente uma entrada ativa na
  whitelist e uma conexão inbound ativa. Portanto a publicação não ativou
  production nem enviou mensagem automaticamente.
- No inbound production, destinatário fora da whitelist continua bloqueado em
  três camadas: elegibilidade antes da execução, revalidação do worker e trigger
  final antes do outbound. A função privada de prontidão permanece sem permissão
  de execução para os papéis da API.
- Reativação continua independente: `test_controlled` usa whitelist, enquanto
  uma campanha explicitamente liberada como `released` pode alcançar sua base
  elegível fora da whitelist. O botão inbound de Pedro não altera esse release.
- A Vercel publicou o deployment `dpl_GGWVB82LjdopuTPUAVNyynFvmocw`, `READY`,
  vinculado pelo status do commit canônico, com o alias
  `https://gril-lac.vercel.app`. `/login` respondeu HTTP 200, `/app/pedro`
  redirecionou corretamente ao login e não houve log de erro nos dez minutos
  consultados.
- Lint, 24 arquivos/117 testes, build Next.js 16.2.12, CI, db lint, dry-run e
  validação direta das definições vivas passaram. A seleção autenticada de
  production e um novo áudio do número allowlisted permanecem para homologação
  manual.
- Evidência detalhada:
  `docs/agent/changes/2026-08-18-remocao-gates-production-inbound.md`.

## Atualização de 18/08/2026 — production inbound visível com whitelist, sem ativação automática

- O PR #58 foi mergeado na branch canônica `phase/01-foundation` no commit
  `0e128fcc2487a8eeec01a41a16ff4eda1090feb6`. Quando existe ao menos um número
  ativo na whitelist, o dashboard de Pedro mostra **Responde automaticamente**
  junto com `off`, `shadow` e `assisted`; cadastrar o número não seleciona nem
  ativa o modo.
- A migration
  `20260818162655_enable_allowlisted_inbound_production.sql` foi aplicada e
  confirmada no Supabase canônico `frslhzwhaooqtivkzdez`. Naquele release, a
  ativação ainda exigia todos os gates de prontidão; elegibilidade, worker e
  outbound bloqueavam respostas automáticas para inbound fora da whitelist. A
  liberação independente de reativação foi preservada.
- Após a migration, a organização e a conversa inbound de homologação
  continuaram em `assisted`, com um número ativo na whitelist. Portanto não
  houve liberação automática de produção nem envio de mensagem.
- A integração automática da Vercel publicou o deployment
  `dpl_2fPZAKYGWb1vfohjakWnWrqMN5LH`, `READY`, a partir do merge canônico e com
  o alias `https://gril-lac.vercel.app`. `/login` respondeu HTTP 200 e
  `/app/pedro` redirecionou corretamente ao login; a consulta de logs de erro
  não retornou ocorrências.
- Lint, 24 arquivos/117 testes, build Next.js 16.2.12 das 46 rotas, CI, dry-run
  e db lint passaram. A limitação de perfil institucional, saúde recente do
  canal e regressão registrada naquele momento foi removida pela atualização
  imediatamente acima.
- Evidência detalhada:
  `docs/agent/changes/2026-08-18-production-inbound-condicionada-a-whitelist.md`.

## Atualização de 17/08/2026 — workspace subsegundo publicado em produção

- O PR #50 foi direcionado à branch canônica `phase/01-foundation` e mergeado no commit `9f28608040134b1ba5d675f8408fd3022d1ea5f1`. Esse merge contém integralmente Dashboard, Chat Pedro/Lionel, redesign operacional, correções de carregamento e `agent/continuous-improvement-loop`.
- A integração automática da Vercel publicou o deployment `dpl_3kQzu51GdmGndaSd1PRo8eMstd6Y`, `Ready`, em `gru1`, com o alias `https://gril-lac.vercel.app`. O tree do merge é idêntico ao tree `7bd45de6789400d62e0abff632392bbb36da6d90` do commit de aplicação validado `dbabc10`.
- O CI do merge passou com lint, 112 testes e build de 46 rotas. Depois da publicação, `/login` respondeu HTTP 200; `/app`, `/app/inbox` e `/app/aprendizados` responderam HTTP 307 para o login, como esperado; a consulta de logs de erro do deployment não retornou ocorrências.
- As migrations até `20260817202000` já estavam aplicadas e alinhadas antes do deploy; nenhuma migration nem alteração de dados foi executada durante esta publicação.
- A publicação foi feita por solicitação explícita do usuário mesmo com a homologação visual/funcional humana ainda pendente. Cold start prolongado continua podendo exceder um segundo; a evidência subsegundo comprovada permanece a navegação autenticada após aquecimento.
- Evidência detalhada: `docs/agent/changes/2026-08-17-producao-workspace-subsegundo.md`.

## Atualização de 17/08/2026 — todas as telas do workspace abaixo de um segundo

- A branch `perf/all-workspace-routes-under-one-second`, publicada no PR draft #50 contra `fix/workspace-loading-bottlenecks`, integra explicitamente `agent/continuous-improvement-loop` e preserva os dois históricos. O merge solicitado está no commit `7af28d0`.
- O shell não bloqueia mais em contadores; badges carregam por uma API assíncrona. Agenda, Kanban, Leads, Campanhas, Auditoria, Privacidade, Relatórios e Aprendizados usam contratos compactos, e o Chat interno substitui quatro viagens sequenciais por um único RPC `SECURITY INVOKER` submetido às RLS existentes.
- Em sessão autenticada com organização populada, todas as 29 telas concluíram o carregamento em até 0,913 s depois do primeiro aquecimento. As rotas afetadas pela passagem fria foram repetidas cinco vezes por rota: os máximos ficaram em 0,867 s no Chat Pedro, 0,747 s em Campanhas, 0,695 s na Central e 0,684 s nos badges.
- As migrations `20260817195000` a `20260817202000` desta entrega estão aplicadas e alinhadas no Supabase `frslhzwhaooqtivkzdez`. A migration de melhoria contínua foi corrigida antes da aplicação para manter o valor canônico `assisted_suggestion`; nenhuma linha foi removida ou normalizada à força.
- `npm run lint`, 23 arquivos/112 testes e o build Next.js 16.2.12 das 46 rotas passaram. O db lint não retornou erros; contratos de RLS, grants, autorização, `search_path` e JIT foram confirmados diretamente no remoto. O pgTAP via CLI não rodou porque o host não possui Docker, limitação registrada no documento da mudança.
- O preview final `https://gril-6w4x08b7u-brio5.vercel.app` (`dpl_EcpVXDE6YrrES2ZNVjsesb1bbaq8`) ficou `Ready` em `gru1` e serviu de evidência prévia; a publicação posterior em produção está registrada na atualização acima. A homologação visual e funcional humana continua obrigatória.
- Evidência detalhada: `docs/agent/changes/2026-08-17-all-workspace-routes-under-one-second.md`.

## Atualização de 17/08/2026 — melhoria contínua governada em branch

- A branch `agent/continuous-improvement-loop`, publicada no PR draft #49 a partir de worktree isolada, foi integrada ao PR draft #50 e preserva `agent/workspace-redesign-real` e os contratos posteriores de desempenho de `fix/workspace-loading-bottlenecks`.
- O código implementa sinais estruturados, agrupamento por meta-revisor, propostas do Lionel, skills versionadas, regressão materializada em jobs e publicação exclusiva pelo dono após 100% dos casos e zero falha crítica. O revisor nunca publica nem altera o prompt central.
- A migration `20260817200000_continuous_improvement_loop.sql` está aplicada no remoto, com `assisted_suggestion` preservado no contrato de `internal_threads`; `20260817201000_optimize_continuous_improvement_routes.sql` consolida o carregamento da página sem mudar as regras de aprovação/publicação. Produção não foi alterada.
- `npm run lint`, os 112 testes e o build das 46 rotas passaram. O db lint remoto ficou sem erros e manteve avisos históricos; os contratos que dependiam de pgTAP foram confirmados diretamente no remoto porque Docker/Podman não existem neste host. A visualização autenticada e os fluxos de escrita permanecem pendentes de homologação humana.
- CI e preview automática do PR passaram; a preview exige SSO. Decisão e detalhes: `docs/decisions/2026-08-17-melhoria-continua-governada.md` e `docs/agent/changes/2026-08-17-melhoria-continua-governada.md`.

## Atualização de 17/08/2026 — correção dos gargalos do workspace

- A migration `20260817150703_optimize_workspace_loading.sql` foi aplicada no Supabase remoto `frslhzwhaooqtivkzdez`; o histórico local e remoto está alinhado nessa versão. Ela preserva o contrato de notificações do Inbox, adiciona projeções planas e agregações para sessão, Dashboard, Central, Leads e Kanban, além de nove índices direcionados às consultas medidas.
- A medição autenticada posterior mostrou que a primeira correção ainda demorava aproximadamente cinco segundos: Inbox consumia 3.708–5.140 ms e a seção de atenção da Visão geral 4.211–4.993 ms. As migrations `20260817183000_workspace_navigation_under_one_second.sql`, `20260817191000_workspace_route_bootstrap.sql`, `20260817193000_lock_workspace_internal_contracts.sql` e `20260817194500_disable_workspace_query_jit.sql` foram então aplicadas e alinhadas no remoto.
- Inbox e Visão geral agora fazem uma única chamada autenticada por rota. A autorização é calculada uma vez por `auth.uid()` e preserva organização, operação, papel, atribuição, grant de conversa e suporte contratual. Em cinco repetições aquecidas pela Data API, o proprietário obteve Inbox em 146–183 ms e Visão geral em 128–169 ms; o corretor ficou em 101–241 ms e 115–189 ms. A tentativa de outra organização retornou `authorized=false` e zero linhas.
- O primeiro preview da correção confirmou `dashboard.workspace` em 370–420 ms e `inbox.workspace` em 528–569 ms nas repetições aquecidas, mas o documento completo ainda levou 1,22–1,85 s. As Functions estavam em `iad1` enquanto o Supabase canônico está em `sa-east-1`; `vercel.json` agora fixa o compute em `gru1` para eliminar essa viagem inter-regional.
- A preview regional reduziu o documento completo do Inbox para 0,44–0,71 s. A Visão geral ainda concluía uma consulta administrativa de 0,47–0,81 s mesmo com a seção recolhida; o preview de limpeza HML- passou a carregar somente quando dono/gestor expande **Área administrativa**, fora da navegação crítica.
- No deployment final de código `dpl_H7o873RJfb9AyRLap3V8bJAxg7Vo`, cinco ciclos autenticados de documento completo retornaram HTTP 200 com Visão geral em 0,36–0,54 s e Inbox em 0,33–0,48 s. Os runtime logs registraram `dashboard.workspace` em 142–240 ms e `inbox.workspace` em 128–243 ms, sem `dashboard.homologation_preview` na navegação comum.
- A implementação de aplicação está na branch `fix/workspace-loading-bottlenecks`, no PR draft #48 contra `agent/workspace-redesign-real`. A preview automática `https://gril-git-fix-workspace-loading-bottlenecks-brio5.vercel.app` está `READY`; produção não foi alterada e o código anterior permanece compatível com a migration já aplicada.
- O shell deixa de aguardar badges, as rotas críticas passam a exibir fallback de carregamento próprio e o Realtime agrupa rajadas, evita refresh em aba oculta e carrega o cliente somente quando necessário.
- Smoke remoto retornou as listagens reais de Inbox, Leads e Kanban em 81–93 ms e os novos contratos de Dashboard, Central e badges em 97–242 ms. `npm run lint`, 110 testes, build Webpack das 46 rotas e CI do PR passaram; a preview não registrou erro nem resposta 500. Permanecem três erros TypeScript preexistentes em dois arquivos de teste, sem impacto no build.
- Detalhes e pendências de publicação: `docs/agent/changes/2026-08-17-workspace-loading-bottlenecks.md` e `docs/agent/changes/2026-08-17-workspace-navigation-under-one-second.md`.

## Atualização de 14/08/2026 — redesign do workspace em homologação

- A Visão geral e o shell desta branch agora implementam arquitetura em camadas: métricas de sete dias como abertura, Kanban identificado como estoque atual sem rolagem horizontal e próximas ações abaixo; a navegação mantém o trabalho frequente visível e recolhe Gestão, Inteligência e Administração. A validação automatizada desta rodada está registrada em `docs/agent/changes/2026-08-14-dashboard-arquitetura-em-camadas.md`.
- A branch `agent/workspace-redesign-real` aplica a arquitetura operacional aprovada sobre a nova Visão geral e preserva os fluxos de Chat com Pedro e Lionel. Uma auditoria autenticada posterior identificou rotas com alteração ainda superficial; Kanban, Agenda, Campanhas, Equipe, Base, Simulador, Organização, Pedro e WhatsApp foram então reestruturados antes da nova homologação.
- Leads e Kanban deixam a navegação principal. Leads passa a ser uma visualização dentro de Conversas; o Kanban completo é aberto pelo resumo da Visão geral.
- Central reúne Pedro, Lionel e eventos operacionais em ordem cronológica, com dez registros por página. Auditoria mostra trinta registros por página.
- Campanhas não ganhou edição de personalidade do Pedro. Paleta, favicon e título da aba continuam iguais aos de produção.
- Após a auditoria autenticada, Campanhas foi reorganizada como uma lista operacional de uma coluna, com uma próxima ação por registro e criação progressiva em quatro etapas. A Central agora abre em `Precisa agir`, mantém o registro cronológico em `Histórico`, traduz estados técnicos e consolida ocorrências repetidas do mesmo evento.
- Lint, 110 testes, build Webpack das 46 rotas, CI e deploy de preview passaram após a correção estrutural. A preview protegida `https://gril-git-agent-workspace-redesign-real-brio5.vercel.app` foi inspecionada com dono, dados reais, desktop e viewport móvel; nenhuma ação de escrita foi executada. Produção e Supabase não foram alterados.
- A preview mostra os callbacks do WhatsApp com base `http://localhost:3000`; revisar `NEXT_PUBLIC_APP_URL` em uma tarefa separada antes da homologação de webhook pela URL exibida.
- Detalhes: `docs/agent/changes/2026-08-14-workspace-operacional-unificado.md` e `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.

## Atualizacao de 07/08/2026 - producao automatica exclusiva para reativacao

- Estado histórico, substituído em 18/08/2026 para o inbound normal pela
  decisão de visibilidade condicionada à whitelist; a restrição de campanhas
  a conversas de reativação continua vigente.
- A migration `20260807180741_reactivation_production_only.sql` foi aplicada no Supabase remoto e registrada como aplicada na history.
- O banco permite `production` somente em campanhas `reactivation`; o inbound normal fica limitado a `off`, `shadow` e `assisted`.
- A abertura da campanha marca a conversa como `journey = reactivation` e os gates de onda, elegibilidade, worker e outbound revalidam a origem.
- A consulta remota confirmou 11 campanhas de reativacao nao-production, nenhuma campanha production e nenhuma organizacao liberada; nenhum lead foi apagado ou alterado.
- Nenhum deploy Vercel foi feito; a homologacao manual de uma campanha de teste permanece pendente.

> Atualizado em 07/08/2026. Este arquivo descreve o estado corrente conhecido; valide fatos mutáveis antes de alterá-los.

## Repositório

- GitHub: `https://github.com/supinovahub/Gril`.
- Branch padrão confirmada: `phase/01-foundation`.
- Último commit de código confirmado nesta branch: `4aaf8f9` (`feat(agenda): add weekly availability editor`).
- Working tree estava limpa antes da criação desta camada de memória.

## Produção e infraestrutura

- Aplicação: `https://gril-lac.vercel.app`.
- Vercel CLI deve autenticar como `suporteinovahub-7501` pelo perfil explícito registrado no `AGENTS.md`.
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations remotas incluem `20260806170711_campaign_edit_archive` e
  `20260806171000_campaign_first_name`; a working tree ainda contém a versão
  não rastreada `20260806165420_campaign_edit_archive.sql` com timestamp local
  divergente da migration de arquivamento já aplicada.
- A migration `20260806125009_add_call_grant_revoked_by.sql` foi aplicada no Supabase remoto para permitir que o roteamento pós-call registre quem revogou a liberação operacional da conversa.
- Deployment de produção confirmado como concluído em 07/08/2026: referência Vercel `GfiLCa9mvTYcTJA81AyLq379NKPU`, alias `https://gril-lac.vercel.app`, publicado a partir do merge `4aaf8f9`.

## Estado funcional

- O MVP cobre onboarding multi-tenant, CRM, inbox WhatsApp, Pedro, qualificação, imóveis, campanhas, agenda/distribuição, follow-ups, simulador, colaboração interna, curadoria e administração da plataforma.
- Uazapi, OpenAI e worker foram conectados ao fluxo real; a homologação operacional pelo dono continua em andamento.
- Pedro deve permanecer em `shadow` ou `assisted` nos atendimentos normais enquanto o comportamento não for integralmente homologado. O modo `production` tem liberação controlada conforme as decisões do produto.
- O roteiro humano canônico é `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Regras comportamentais do Pedro estão resumidas em `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md` e detalhadas nos documentos de produto/decisão.

## Últimas correções comprovadas

- O inbox recebe e exibe conversas reais da Uazapi.
- Dono ou gestor com permissão de CRM pode editar manualmente o nome do contato no detalhe do Inbox ou do lead; a alteração é auditada e preserva o telefone canônico.
- A edição de nome no Inbox envia o UUID canônico do contato e não retorna mais `invalid uuid`.
- Execuções recuperadas do Pedro republicam o evento necessário para o worker.
- O nudge após envio de material não reenvia PDFs.
- Pedido de disponibilidade usa horários aprovados e não cria handoff indevido quando existem slots válidos.
- Nenhuma palavra isolada executa controle antes do Pedro: o worker envia mensagens elegíveis para análise contextual, escaladas exigem evidência e confiança, e as funções legadas pré-IA estão sem permissão até para `service_role`.
- Os contextos de teste usados na homologação foram removidos do banco remoto com todo o contexto operacional associado; os eventos de auditoria imutáveis foram preservados. A limpeza mais recente, repetida em 06/08/2026, zerou contato, telefone, conversa, mensagens, qualificações, IA, oportunidade, call, reservas, ingestões, jobs e outbox do alvo.
- A decisão estruturada do Pedro passou a ser a fonte de verdade: o executor não seleciona projetos adicionais, não substitui mídia ou texto e bloqueia mutações semânticas. Um book escolhido gera somente a ação explícita correspondente.
- Edição humana de sugestão envia somente o texto editado e invalida as ações estruturadas anteriores.
- Quando o lead confirma o formato depois de escolher um horário, Pedro preserva o slot já confirmado; o banco reaproveita a call existente e impede duas calls ativas no mesmo slot.
- Quando existe uma call futura ativa, Pedro recebe esse slot como estado canônico; respostas que dizem que o horário passou são regeneradas ou bloqueadas antes do envio.
- O registro de resultado de call após o início agora conclui a revogação da liberação operacional da conversa, preservando `revoked_by` e evitando o erro de coluna inexistente.
- A janela de slots de call do worker e do banco agora respeita no mínimo uma hora de antecedência; pedidos explícitos abaixo desse limite continuam escalando silenciosamente para o gestor sem acionar corretores. Inbox e CRM formatam timestamps no fuso da operação.
- No código atual, a confirmação de e-mail de um convite individual recupera o convite pelo cookie, encerra apenas a sessão local anterior e retorna ao e-mail convidado; a correção está publicada e a homologação manual ainda está pendente.

## Verificações deste retrato

- `npm run lint`, `npm test` (18 arquivos e 99 testes) e `npm run build` aprovados em 06/08/2026 após a correção de antecedência e fuso; o build confirmou 46 rotas.
- Migrações Supabase: local e remoto alinhados até a versão indicada acima; colunas de rastreabilidade, função pós-análise, índice idempotente e revogação das funções legadas confirmados no remoto.
- `npx supabase db lint --linked --fail-on error`: concluído sem erros; permanecem apenas avisos preexistentes.
- Após a correção do fluxo de convite: `npm test` com 98 testes, `npm run lint` e `npm run build` com 46 rotas aprovados localmente; o commit `cea8119` foi publicado em produção no deployment `dpl_2RMP14xp41hB2YRds46EoQN8gRCN`.
- Migration `20260806125009_add_call_grant_revoked_by.sql`: aplicada remotamente; `npx supabase db push --linked --dry-run` confirmou o banco atualizado; simulações autenticadas de `no_result` e `start_negotiation` passaram com `ROLLBACK`.
- Migration `20260806144434_enforce_one_hour_call_lead_time.sql`: aplicada remotamente; o dry-run mostrou somente essa migration; a função remota rejeita o bypass de uma hora e uma chamada iniciada em 10 minutos retornou primeiro slot com mais de uma hora de antecedência.
- Vercel: o deployment `gril-fejl110ao-brio5.vercel.app` está `Ready`, o alias público responde `200` em `/login`, e a identidade usada foi `suporteinovahub-7501` pelo perfil explícito obrigatório.
- Vercel: o deployment `gril-1jotu4cvc-brio5.vercel.app` está `Ready`, o alias público responde `200` em `/login`, e a identidade usada foi `suporteinovahub-7501` pelo perfil explícito obrigatório.
- Limpeza de contexto: os registros de homologação foram removidos do Supabase remoto em 05/08/2026 e 06/08/2026; a segunda limpeza de 06/08 zerou contato, oportunidade, conversa, mensagens, qualificações, IA, call, hold, reservas, jobs, outbox, ingestões e vínculos derivados. A auditoria relacionada permanece por regra do produto.

## Pendências operacionais

- Continuar a homologação manual dos fluxos descritos no guia, especialmente comportamento do Pedro, agendamento, distribuição, reativação e integrações reais.
- Homologar manualmente a edição de nome com dono/gestor e confirmar que corretor não recebe a ação nem consegue forjar a operação.
- Registrar cada novo defeito com esperado, observado, lead/canal, horário e IDs técnicos quando disponíveis.
- Recriar um lead de teste somente quando necessário para nova homologação, sem reutilizar os dados removidos.
- Atualizar este arquivo após qualquer alteração de deployment, migration, conta/projeto ou conclusão material de homologação.
- Repetir a homologação manual do registro de resultado no dashboard.
- Homologar com um corretor novo o link de confirmação em um navegador que possui outra conta localmente autenticada, confirmando que a sessão final pertence ao e-mail convidado e retorna ao convite.
- Homologar manualmente a exibição do fuso operacional no Inbox/CRM e o comportamento de um pedido explícito de call abaixo de uma hora com um lead de teste novo.

## Protocolo compartilhado

- Todo novo Codex deve iniciar na raiz do repositório e seguir `docs/agent/ONBOARDING_PROMPTS.md`.
- Correções funcionais devem comparar os sete documentos originais, decisões posteriores, implementação atual e comportamento observado.
- Bug técnico inequívoco pode ser corrigido diretamente quando autorizado; lacuna ou mudança de produto exige discussão e aprovação antes da implementação.

## Limites desta fonte

## Atualização de 06/08/2026

- As migrations `20260806151846_add_homologation_context_cleanup.sql` e `20260806153847_add_homologation_context_catalog_anchors.sql` foram aplicadas ao Supabase remoto e estão alinhadas localmente.
- O dashboard agora oferece preview e limpeza protegida somente para contexto HML-, limitada a 20 contatos, com bloqueio de referências cruzadas, confirmação literal, transação no banco e auditoria preservada.
- Preview autenticado e smoke test com contato sintético em transação revertida passaram; `npx supabase db lint --linked --fail-on error` passou com avisos preexistentes.
- Deployment de produção `dpl_5NHYjVdK4kQjwKKX8mkeNiXzUYTH` ficou `Ready`, com alias `https://gril-lac.vercel.app`; `/login` respondeu HTTP 200.

## Atualização de 06/08/2026 — whitelist do inbound do Pedro

- A tela de Pedro agora permite cadastrar números E.164 em escopo da
  organização para testes controlados do inbound normal em `production`.
- A migration `20260806165243_enforce_pedro_inbound_allowlist.sql` foi aplicada
  no Supabase remoto e adiciona bloqueio na elegibilidade, revalidação antes
  do worker e trigger final antes de qualquer outbound de IA.
- A mudança foi publicada no deployment Vercel
  `dpl_APSFrhXy7vtcrJBWDaN9g6KA6gq9`, alias `https://gril-lac.vercel.app`,
  com status `Ready`; a homologação funcional continua pendente.
- O registro detalhado está em
  `docs/agent/changes/20260806-pedro-inbound-production-allowlist.md`.

## Atualização de 06/08/2026 — primeiro nome na campanha de reativação

- A migration `20260806171000_campaign_first_name.sql` foi aplicada no
  Supabase remoto. Ela cria o snapshot `campaign_contacts.campaign_first_name`
  e faz preview e runtime usarem o primeiro termo, sem alterar o nome completo
  do CRM.
- A verificação remota confirmou migration, coluna, trigger, renderizador e
  executor de campanha ativos; a aplicação publicada continua `Ready` no
  deployment `dpl_APSFrhXy7vtcrJBWDaN9g6KA6gq9`, alias
  `https://gril-lac.vercel.app`.
- Não houve novo deploy Vercel porque a correção não altera o bundle da
  aplicação; a publicação efetiva foi a migration no banco único.
- O histórico local ainda tem a migration não rastreada
  `20260806165420_campaign_edit_archive.sql`, enquanto o remoto registra essa
  frente como `20260806170711`. O push desta alteração usou uma cópia temporária
  alinhada; não foi feito `migration repair`.

## Atualização de 06/08/2026 — remoção da revisão individual da onda

- A migration `20260806180518_remove_campaign_wave_review_gate.sql` foi
  aplicada no Supabase remoto. Ondas novas não criam revisões por contato e não
  dependem da aprovação da onda anterior; revalidação de opt-out, supressão,
  conexão ativa, pausa e limite de volume permanecem ativas.
- Ondas existentes foram normalizadas para não manter uma revisão pendente; os
  14 registros históricos de revisão foram preservados.
- A interface e as actions de revisão individual foram removidas no commit
  `a68701c`, publicado na branch `feat/remove-campaign-wave-review-gate`.
- O deployment de produção `dpl_2C2rC72vcxhnoPbWQxQGTD9DZXmh` está `Ready`,
  com alias `https://gril-lac.vercel.app`; `/login` respondeu HTTP 200.
- A regra foi registrada em
  `docs/decisions/campaign-wave-review-gate-disabled.md` e o detalhe da
  mudança em `docs/agent/changes/2026-08-06-remocao-revisao-onda.md`.

Este documento não substitui:

- o banco para estado transacional;
- Git/GitHub para código e autoria;
- Vercel para estado de deployment;
- os sete documentos de produto para regras consolidadas;
- os registros em `changes/` para histórico detalhado.

## Atualização de 06/08/2026 — whitelist somente em production

- A migration `20260806193000_allow_assisted_inbound_ai.sql` foi aplicada no
  Supabase remoto e registrada como aplicada.
- A elegibilidade do inbound agora ignora a whitelist nos modos `shadow` e
  `assisted`; a revalidação antes do worker e o trigger final continuam
  exigindo whitelist somente para `production`.
- A conversa de homologação do João passou a retornar `ai_eligible = true`
  em `assisted`, sem alterar registros nem disparar reprocessamento durante a
  validação.
- O `db push --linked` continua impedido pela divergência histórica já
  existente entre `20260806165420_campaign_edit_archive` local e
  `20260806170711` remoto; a migration corretiva foi aplicada por SQL
  transacional e sua versão foi registrada explicitamente.

## Atualização de 07/08/2026 — publicação da separação de campanhas arquivadas

- A correção da listagem de campanhas foi publicada no deployment de produção
  `dpl_5Cg5HadfzakZAT4WtRi82EVbhP8s`, com status `READY`, no projeto Vercel
  `gril` do time `brio5`.
- O alias público `https://gril-lac.vercel.app/login` respondeu HTTP 200 após
  a publicação; o último deployment do projeto aponta para esse deployment.
- Nenhuma migration ou alteração de dados foi aplicada nesta publicação.
- A homologação manual das abas “Ativas” e “Arquivadas” permanece pendente.
## Atualização de 07/08/2026 — restauração das mensagens dinâmicas

- A lógica de mensagens dinâmicas foi reintegrada à separação entre campanhas
  ativas e arquivadas no commit `1d3867a`, mergeado na branch padrão pelo PR
  `#34` no commit `b3720f9`.
- O deployment de produção `dpl_GYof2cybajLb18xQJhF3n4YfoSBh` ficou `Ready`;
  o alias `https://gril-lac.vercel.app/login` respondeu HTTP 200.
- O CI do merge passou com lint, testes e build; nenhuma migration foi
  aplicada, pois `20260806202829_campaign_dynamic_messages.sql` já estava
  aplicada no Supabase remoto.
- A homologação manual da rotação sem repetição, dos dados adicionais da
  planilha e das abas “Ativas”/“Arquivadas” permanece pendente.

## Atualização de 08/08/2026 — integração do Chat com Pedro

- A mudança omitida foi reintegrada sobre a produção atual pelos commits
  funcionais `61f3efa` e `104f13c`, com a decisão normalizada em `14174ea`.
- O Chat com Pedro agora recebe sugestões `assisted` por lead, mostra a
  resposta exata, o resumo e a mensagem inbound analisada, permite abrir o
  Inbox e usa o mesmo fluxo transacional de aprovação, edição, ensino e
  descarte.
- Foram incluídas as migrations `20260806165000_chat_pedro_assisted_queue.sql`
  e `20260807130110_chat_pedro_suggestion_context.sql`, além dos testes SQL e
  registros de mudança correspondentes; ambas já constam aplicadas no Supabase
  remoto.
- O deploy do bundle permanece pendente nesta etapa; a homologação manual do
  mesmo caso no Inbox e no Chat também permanece pendente.

## Atualização de 07/08/2026 — publicação do Chat com Pedro

- O PR `#36` foi mergeado na branch padrão pelo commit `2bc673d`.
- O deployment de produção do Vercel foi concluído com sucesso no deployment
  `2RbxCrjPHvvy6485j7DtMhvQWz9g`; a rota pública é
  `https://gril-lac.vercel.app`.
- A raiz pública respondeu HTTP 200 e `/app/chat-pedro` respondeu HTTP 307 para
  `/login?next=%2Fapp%2Fchat-pedro`, confirmando a proteção esperada da rota.
- As migrations do Chat já constavam aplicadas no Supabase remoto; nenhuma
  alteração de banco foi executada nesta publicação.
- A homologação manual autenticada do fluxo do Chat com Pedro permanece
  pendente.

## Atualização de 07/08/2026 — editor semanal de disponibilidade

- O PR `#38` foi mergeado na branch padrão pelo commit `4aaf8f9`.
- O deployment Vercel associado ao commit foi concluído com sucesso, com a
  referência `GfiLCa9mvTYcTJA81AyLq379NKPU`; o alias de produção é
  `https://gril-lac.vercel.app`.
- `https://gril-lac.vercel.app/login` respondeu HTTP 200 após a publicação.
- Nenhuma migration ou alteração de dados foi aplicada.
- A homologação manual autenticada da seleção múltipla, presets, edição,
  remoção e períodos divididos permanece pendente.

## Atualização de 10/08/2026 — prioridade de atenção no Inbox

- A rota `/app/inbox` agora coloca no topo as conversas com mensagens inbound
  não lidas ou sugestões pendentes da IA; dentro de cada grupo, ordena por
  `updated_at` decrescente.
- Para preservar o limite de 100 itens sem esconder pendências antigas, o
  código busca os 100 itens recentes e recupera separadamente conversas com
  notificações fora dessa janela antes da ordenação final.
- Nenhuma migration, alteração de dados, consulta externa, deploy ou mudança
  de RLS foi feita nesta tarefa. O registro detalhado está em
  `docs/agent/changes/2026-08-10-ordenacao-atencao-inbox.md`.
- `npm run lint` e `npm test` passaram; o build compilou e concluiu TypeScript,
  mas a coleta de páginas não pôde terminar porque este workspace não possui
  as variáveis públicas do Supabase. A homologação visual autenticada continua
  pendente.

## Atualização de 11/08/2026 — clareza dos fluxos e publicação integrada

- O PR #42 foi mergeado na branch padrão no commit
  `ec800483e220d1645edfec802183cd2b197c4b66`.
- O release acrescenta orientações e rótulos mais claros no Dashboard, Inbox,
  Pedro, Leads e Agenda para usuários que não desenvolveram o sistema.
- A regra posterior de produção do Pedro e o runtime autônomo de IA das
  campanhas foram reintegrados antes da publicação; as features anteriores de
  campanhas, CSV, ondas e Chat com Pedro já estavam na base e foram preservadas.
- A lista local/remota de migrations está alinhada até `20260810140144`; nenhum
  SQL foi aplicado durante este deploy.
- O deployment de produção Vercel
  `dpl_CsxDCbaVsw6hxLGpP1bpaCkj4WLW` está `READY`, com alias
  `https://gril-lac.vercel.app`; `/login` respondeu HTTP 200 e não foram
  encontrados logs de erro na última hora.
- A homologação visual e operacional autenticada continua pendente. O build
  local pré-empacotado encontrou uma limitação de symlink do Windows depois de
  compilar; o build remoto da Vercel foi concluído com 46 rotas.

## Atualização de 14/08/2026 — Visão geral com métricas e Kanban

- A branch `agent/dashboard-redesign-real`, publicada no PR rascunho #46,
  substitui a composição técnica do Dashboard por quatro métricas comerciais,
  seletor de período e um snapshot somente leitura do Kanban real. A preview é
  `https://gril-git-agent-dashboard-redesign-real-brio5.vercel.app`.
- A decisão aprovada remove “Bom dia, Pedro” e “Hoje na operação”, limita
  atenção e agenda a três itens e recolhe a limpeza HML em “Área
  administrativa”.
- Paleta, favicon, título do navegador, rotas, permissões, RLS e contratos de
  banco permanecem iguais à produção. Nenhuma migration, alteração de dados ou
  deploy de produção foi executado; a preview automática ficou `Ready`.
- A validação automatizada desta branch está registrada em
  `docs/agent/changes/2026-08-14-dashboard-metricas-kanban.md`; a homologação
  autenticada em desktop e mobile com dados reais permanece pendente.
