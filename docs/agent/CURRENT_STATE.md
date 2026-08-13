# Estado atual compartilhado do Gril

## Atualização de 13/08/2026 — repaginação visual Taste / Triage Desk

- A branch de preview `preview/ui-ux-taste-20260813` recebeu uma nova direção visual aprovada pelo usuário, baseada nos princípios anti-slop da Taste Skill e adaptada ao produto B2B: `Ink, Paper, Signal`.
- O shell autenticado, as primitives compartilhadas, o Dashboard e Conversas foram reorganizados visualmente para priorizar atenção, triagem, legibilidade e responsividade, sem alterar rotas, aliases, labels, permissões, queries, server actions ou banco.
- A validação local passou com lint, 110 testes, build das 47 rotas e smoke visual desktop/mobile em `/login`. O fluxo autenticado na preview pública ainda precisa de homologação manual.
- Nenhum deploy de produção, migration ou alteração de dados foi feito nesta frente. O registro detalhado está em `docs/agent/changes/2026-08-13-reformulacao-ui-taste-triage-desk.md`.

## Atualizacao de 07/08/2026 - producao automatica exclusiva para reativacao

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

## Atualização de 13/08/2026 — primeira fatia da refatoração UI/UX

- Na branch `agent/ui-architecture-audit`, a navegação principal passou a
  apresentar Conversas como entrada canônica; `/app/inbox` permanece como
  alias compatível e o detalhe existente da conversa foi preservado.
- O Dashboard foi reorganizado em atenção imediata, operação do dia,
  indicadores resumidos e atividade recente. A Central de operações unifica
  os eventos existentes, com filtros e paginação de dez itens por página; a
  Auditoria recebeu limite visual de 30 itens por página, filtros e leitura de
  metadados.
- Campanhas agora apresentam um wizard de cinco etapas e Pedro/IA expõe os
  contextos independentes Atendimento e Reativação. Nenhuma migration, deploy,
  alteração de dados ou mudança de API foi feita.
- Relatórios deixou de ocupar a navegação primária e continua acessível no
  menu secundário; Equipe passou a comunicar explicitamente os modelos
  Corretor e Imobiliária antes dos controles de acesso existentes.
- A validação local desta fatia passou com lint, 110 testes e build de 47
  rotas usando as variáveis locais; `/login` respondeu HTTP 200. A
  homologação autenticada e o smoke visual seguem pendentes.
- O registro detalhado está em
  `docs/agent/changes/2026-08-13-refatoracao-ui-ux-fatia-inicial.md`.

## Atualização de 13/08/2026 — corte visual para preview

- A fatia seguinte consolidou tokens de foco, espaçamento e interação, além de
  primitives compartilhadas para ações, cartões, abas, campos e estados vazios.
- O shell passa a apresentar Gril como produto principal; Pedro continua
  identificado como capacidade de IA. Dashboard e Conversas adotam as
  primitives sem alterar actions, consultas, RLS, APIs, workers ou migrations.
- Lint, 110 testes e build de 47 rotas passaram. O build usou as variáveis
  públicas locais somente no processo; nenhum segredo foi versionado.
- A continuação desta tarefa foi autorizada explicitamente pelo usuário apesar
  do preflight de concorrência ter encontrado worktrees com caminhos
  sobrepostos. Nenhuma outra worktree ou branch foi alterada, integrada, limpa
  ou publicada.

## Atualizacao de 13/08/2026 - preview UI/UX publicado

- A branch `preview/ui-ux-20260813` foi criada a partir de
  `origin/phase/01-foundation`, recebeu o corte visual no commit
  `756f8e266bceaf98dc01ec6dd76cc18e1ac31bda` e foi publicada no GitHub.
- A Vercel concluiu o deployment de preview
  `dpl_2kQwUJpwJSatecHkDwX1gej34L8r` com status `Ready`.
- URL publica: `https://gril-mxc84z541-brio5.vercel.app`; alias da branch:
  `https://gril-git-preview-ui-ux-20260813-brio5.vercel.app`.
- `/login` respondeu HTTP 200. Nao houve promocao para producao, migration ou
  alteracao de dados. A homologacao autenticada e o smoke visual seguem
  pendentes.
