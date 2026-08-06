# Estado atual compartilhado do Gril

> Atualizado em 06/08/2026. Este arquivo descreve o estado corrente conhecido; valide fatos mutáveis antes de alterá-los.

## Repositório

- GitHub: `https://github.com/supinovahub/Gril`.
- Branch padrão confirmada: `phase/01-foundation`.
- Último commit de código confirmado nesta branch: `d930949` (`fix(agenda): enforce one-hour call lead time`).
- Working tree estava limpa antes da criação desta camada de memória.

## Produção e infraestrutura

- Aplicação: `https://gril-lac.vercel.app`.
- Vercel CLI deve autenticar como `suporteinovahub-7501` pelo perfil explícito registrado no `AGENTS.md`.
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations locais e remotas estão alinhadas até `20260806170711_campaign_edit_archive.sql`, incluindo as migrations concorrentes `20260806165000_chat_pedro_assisted_queue.sql` e `20260806165243_enforce_pedro_inbound_allowlist.sql`.
- A migration `20260806125009_add_call_grant_revoked_by.sql` foi aplicada no Supabase remoto para permitir que o roteamento pós-call registre quem revogou a liberação operacional da conversa.
- Deployment de produção confirmado como `Ready` em 06/08/2026: `gril-1jotu4cvc-brio5.vercel.app` (`dpl_HXdp4BrqHY7zCDQtG6F7d9BUSZpx`), alias `https://gril-lac.vercel.app`, publicado a partir do commit `d930949`.

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
- Campanhas de reativação agora permitem edição segura antes de ondas liberadas e arquivamento terminal auditado, com aba separada para campanhas arquivadas e cancelamento de jobs pendentes.
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
- Publicar o código da edição/arquivamento de campanhas no Vercel e homologar o fluxo com uma campanha de teste nova; a migration já está aplicada no Supabase remoto.

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
- A migration `20260806165243_enforce_pedro_inbound_allowlist.sql` adiciona
  bloqueio na elegibilidade, revalidação antes do worker e trigger final antes
  de qualquer outbound de IA; ela ainda não foi aplicada no Supabase remoto.
- A homologação funcional e a publicação dessa mudança continuam pendentes.
- O registro detalhado está em
  `docs/agent/changes/20260806-pedro-inbound-production-allowlist.md`.

Este documento não substitui:

- o banco para estado transacional;
- Git/GitHub para código e autoria;
- Vercel para estado de deployment;
- os sete documentos de produto para regras consolidadas;
- os registros em `changes/` para histórico detalhado.
