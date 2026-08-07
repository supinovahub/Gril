# Produção automática exclusiva para reativação

- Data: 07/08/2026
- Status: decisão confirmada pelo pedido atual do usuário

## Decisão

O modo `production` do Pedro fica disponível somente para campanhas cujo tipo é
`reactivation`. O atendimento normal (`inbound`) pode operar em `off`, `shadow`
ou `assisted`, mas não pode gerar resposta automática em produção.

A liberação da reativação é independente do atendimento normal e exige:

- `reactivation_ai_mode = production`;
- `reactivation_release_state = test_controlled` ou `released`;
- allowlist ativa para teste controlado;
- opt-out, supressão, ownership, pausa e demais gates determinísticos válidos.

## Aplicação

A regra é aplicada em quatro momentos: configuração da campanha, liberação da
onda, elegibilidade da conversa e execução/envio da resposta. Uma conversa
antiga ou uma configuração obsoleta não pode reabrir produção no inbound.

Esta decisão substitui explicitamente
`docs/decisions/inbound-production-restored.md` no ponto em que aquela decisão
permitia `production` para atendimento normal.

## Rollout

Código e migration devem ser publicados juntos. A migration não foi aplicada
ao Supabase remoto nesta tarefa. A homologação deve provar que uma campanha de
reativação liberada responde, enquanto uma conversa inbound normal permanece
sem resposta automática.
