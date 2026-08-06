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
- Supabase remoto único: projeto `frslhzwhaooqtivkzdez`; não existe staging separado.
- Migrations locais e remotas estão alinhadas até `20260806140816_restore_inbound_production.sql`.
- A migration `20260806125009_add_call_grant_revoked_by.sql` foi aplicada no Supabase remoto para permitir que o roteamento pós-call registre quem revogou a liberação operacional da conversa.
- A migration `20260806140816_restore_inbound_production.sql` foi aplicada no Supabase remoto para restaurar `production` no atendimento inbound, mantendo os gates de prontidão.
- Deployment de produção confirmado como `Ready` em 06/08/2026: `gril-ns0qtvkbr-brio5.vercel.app` (`dpl_9hEURMxYCbkujSUpArLZik81rjVG`), alias `https://gril-lac.vercel.app`, publicado a partir do commit `91fcf24`.

## Estado funcional

- O MVP cobre onboarding multi-tenant, CRM, inbox WhatsApp, Pedro, qualificação, imóveis, campanhas, agenda/distribuição, follow-ups, simulador, colaboração interna, curadoria e administração da plataforma.
- Uazapi, OpenAI e worker foram conectados ao fluxo real; a homologação operacional pelo dono continua em andamento.
- Pedro permanece desligado por padrão nos atendimentos normais; `shadow`, `assisted` e `production` ficam disponíveis com liberação controlada pelos gates e pelas decisões do produto.
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
- O atendimento normal voltou a oferecer o modo `production`; a Server Action e o banco aceitam o modo, mas a ativação continua condicionada aos gates de identidade, conhecimento, modelo, canal saudável e regressão aprovada.
- O Chat com Pedro agora está preparado para receber sugestões `assisted` por lead, com resposta exata, link para o Inbox e revisão humana pelo mesmo fluxo transacional; a publicação dessa mudança ainda está pendente.
- No código atual, a confirmação de e-mail de um convite individual recupera o convite pelo cookie, encerra apenas a sessão local anterior e retorna ao e-mail convidado; a publicação está confirmada e a homologação manual continua pendente.

## Verificações deste retrato

- `npm run lint`, `npm test` (17 arquivos e 97 testes) e `npm run build` aprovados em 05/08/2026 após a proteção da resposta para call futura.
- Migrações Supabase: local e remoto alinhados até a versão indicada acima; colunas de rastreabilidade, função pós-análise, índice idempotente e revogação das funções legadas confirmados no remoto.
- `npx supabase db lint --linked --fail-on error`: concluído sem erros; permanecem apenas avisos preexistentes.
- Após a correção do fluxo de convite: `npm test` com 98 testes, `npm run lint` e `npm run build` com 46 rotas aprovados localmente; não houve deploy nesta tarefa.
- Migrations `20260806125009_add_call_grant_revoked_by.sql` e `20260806140816_restore_inbound_production.sql`: aplicadas remotamente; `npx supabase migration list --linked` confirmou alinhamento; a consulta remota confirmou o check inbound com `production` e a remoção da trava antiga.
- Vercel: o deployment `gril-ns0qtvkbr-brio5.vercel.app` está `Ready`, o alias público responde `200` em `/login`, não houve log de erro na janela verificada, e a identidade usada foi `suporteinovahub-7501` pelo perfil explícito obrigatório.
- Limpeza de contexto: o registro de homologação foi removido do Supabase remoto em 05/08/2026; a verificação zerou contato, oportunidade, conversa, mensagens, IA, calls, jobs, outbox e vínculos derivados. A auditoria relacionada permanece por regra do produto.

## Pendências operacionais

- Continuar a homologação manual dos fluxos descritos no guia, especialmente comportamento do Pedro, agendamento, distribuição, reativação e integrações reais.
- Homologar manualmente a edição de nome com dono/gestor e confirmar que corretor não recebe a ação nem consegue forjar a operação.
- Registrar cada novo defeito com esperado, observado, lead/canal, horário e IDs técnicos quando disponíveis.
- Recriar um lead de teste somente quando necessário para nova homologação, sem reutilizar os dados removidos.
- Atualizar este arquivo após qualquer alteração de deployment, migration, conta/projeto ou conclusão material de homologação.
- Repetir a homologação manual do registro de resultado no dashboard.
- Homologar no Chat com Pedro a fila de sugestões `assisted`, a edição/aprovação, o descarte e o conflito de versão com o Inbox.
- Homologar com um corretor novo o link de confirmação em um navegador que possui outra conta localmente autenticada, confirmando que a sessão final pertence ao e-mail convidado e retorna ao convite.

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
