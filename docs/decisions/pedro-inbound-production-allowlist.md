# Whitelist do Pedro no inbound de produção

## Decisão

No atendimento normal (`journey = inbound`) em modo `production`, somente
contatos cujo telefone ativo esteja cadastrado em `ai_test_allowlist` podem
gerar execução do Pedro e receber mensagens automáticas. A whitelist é de
organização; registros antigos com `operation_id` preenchido continuam válidos
somente na operação correspondente.

Contatos fora da whitelist continuam podendo entrar no Inbox, mas não geram
turno de modelo nem mensagem automática. `shadow` e `assisted` permanecem
disponíveis para esses contatos, e a reativação continua submetida ao seu
próprio `reactivation_release_state`.

## Portões

- a elegibilidade do inbound consulta a whitelist antes de criar a execução;
- uma execução `production` enfileirada é bloqueada se o número for removido
  antes do worker iniciá-la;
- um trigger final impede qualquer mensagem outbound com `sender_type = ai`
  para contato inbound não allowlisted;
- inclusões, reativações e remoções da whitelist entram na auditoria;
- a regra é aplicada no banco, portanto não depende da interface ou do worker.

## Rollout e rollback

A migration deve ser aplicada antes de habilitar `production` no inbound. Sem
registros ativos na whitelist, o inbound normal em `production` não responde
automaticamente. O rollback remove os novos gates e mantém a tabela existente
usada pelo fluxo de campanhas.
