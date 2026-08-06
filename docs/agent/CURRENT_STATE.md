# Estado atual compartilhado do Gril

> Atualizado em 06/08/2026. Este arquivo descreve o estado corrente conhecido; valide fatos mutáveis antes de alterá-los.

## Repositório

- GitHub: `https://github.com/supinovahub/Gril`.
- Branch padrão confirmada: `phase/01-foundation`.
- Último commit de código confirmado nesta branch: `fe3399a` (`fix(pedro): preserve active call in response context`).
- Working tree estava limpa antes da criação desta camada de memória.

## Produção e infraestrutura

- Aplicação: `https://gril-lac.vercel.app`.
- Vercel CLI deve autenticar como `suporteinovahub-7501` pelo perfil explícito registrado no `AGENTS.md`.
- Deployment de produção confirmado como `Ready` em 05/08/2026: `gril-lha8b45yt-brio5.vercel.app` (`dpl_6CXsWB6HFg4YXrGCvQgJUeLf6JN2`), alias `https://gril-lac.vercel.app`, publicado a partir da branch `agent/fix-call-slot-preservation-published` com o commit `fe3399a`.
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations locais e remotas estão alinhadas até `20260806125009_add_call_grant_revoked_by.sql`.
- A migration `20260806125009_add_call_grant_revoked_by.sql` foi aplicada no Supabase remoto para permitir que o roteamento pós-call registre quem revogou a liberação operacional da conversa.
- O deployment de produção continua sendo o de `fe3399a`; a publicação deste ajuste de código está pendente porque a identidade Vercel obrigatória não pôde ser validada neste host.

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
- Os contextos de teste usados na homologação foram removidos do banco remoto com todo o contexto operacional associado; os eventos de auditoria imutáveis foram preservados. A limpeza mais recente zerou contato, conversa, mensagens, IA, oportunidade, call, reservas, jobs e outbox do alvo.
- A decisão estruturada do Pedro passou a ser a fonte de verdade: o executor não seleciona projetos adicionais, não substitui mídia ou texto e bloqueia mutações semânticas. Um book escolhido gera somente a ação explícita correspondente.
- Edição humana de sugestão envia somente o texto editado e invalida as ações estruturadas anteriores.
- Quando o lead confirma o formato depois de escolher um horário, Pedro preserva o slot já confirmado; o banco reaproveita a call existente e impede duas calls ativas no mesmo slot.
- Quando existe uma call futura ativa, Pedro recebe esse slot como estado canônico; respostas que dizem que o horário passou são regeneradas ou bloqueadas antes do envio.
- O registro de resultado de call após o início agora conclui a revogação da liberação operacional da conversa, preservando `revoked_by` e evitando o erro de coluna inexistente.

## Verificações deste retrato

- `npm run lint`, `npm test` (17 arquivos e 97 testes) e `npm run build` aprovados em 05/08/2026 após a proteção da resposta para call futura.
- Migrações Supabase: local e remoto alinhados até a versão indicada acima; colunas de rastreabilidade, função pós-análise, índice idempotente e revogação das funções legadas confirmados no remoto.
- `npx supabase db lint --linked --fail-on error`: concluído sem erros; permanecem apenas avisos preexistentes.
- Migration `20260806125009_add_call_grant_revoked_by.sql`: aplicada remotamente; `npx supabase db push --linked --dry-run` confirmou o banco atualizado; simulações autenticadas de `no_result` e `start_negotiation` passaram com `ROLLBACK`.
- Vercel: o deployment `gril-lha8b45yt-brio5.vercel.app` está `Ready`, o alias público responde `307` para `/login` e depois `200`, e a identidade usada foi `suporteinovahub-7501` pelo perfil explícito obrigatório.
- Limpeza de contexto: o registro de homologação foi removido do Supabase remoto em 05/08/2026; a verificação zerou contato, oportunidade, conversa, mensagens, IA, calls, jobs, outbox e vínculos derivados. A auditoria relacionada permanece por regra do produto.

## Pendências operacionais

- Continuar a homologação manual dos fluxos descritos no guia, especialmente comportamento do Pedro, agendamento, distribuição, reativação e integrações reais.
- Homologar manualmente a edição de nome com dono/gestor e confirmar que corretor não recebe a ação nem consegue forjar a operação.
- Registrar cada novo defeito com esperado, observado, lead/canal, horário e IDs técnicos quando disponíveis.
- Recriar um lead de teste somente quando necessário para nova homologação, sem reutilizar os dados removidos.
- Atualizar este arquivo após qualquer alteração de deployment, migration, conta/projeto ou conclusão material de homologação.
- Publicar o commit desta correção pela identidade Vercel autorizada e repetir a homologação manual do registro de resultado no dashboard.

## Protocolo compartilhado

- Todo novo Codex deve iniciar na raiz do repositório e seguir `docs/agent/ONBOARDING_PROMPTS.md`.
- Correções funcionais devem comparar os sete documentos originais, decisões posteriores, implementação atual e comportamento observado.
- Bug técnico inequívoco pode ser corrigido diretamente quando autorizado; lacuna ou mudança de produto exige discussão e aprovação antes da implementação.

## Limites desta fonte

Este documento não substitui:

- o banco para estado transacional;
- Git/GitHub para código e autoria;
- Vercel para estado de deployment;
- os sete documentos de produto para regras consolidadas;
- os registros em `changes/` para histórico detalhado.
