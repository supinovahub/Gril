# Runbooks mínimos

## Provedor indisponível

1. Pausar a conexão e todas as ações proativas.
2. Manter eventos idempotentes em fila, sem reenvio manual cego.
3. Confirmar health check estável antes de pedir nova ativação.
4. Reprocessar por idempotency key e conferir contagens de mensagens.

## Envio duplicado ou após opt-out

1. Aplicar pausa global da operação.
2. Registrar incidente e preservar IDs externos, sem apagar evidência.
3. Confirmar supressão, cancelar jobs pendentes e identificar o caminho que ignorou o gate.
4. Corrigir e executar regressão crítica antes de retomar.

## Capacidade divergente

1. Pausar campanhas, reativações e follow-ups.
2. Comparar `operation_capacity.active_count` com conversas que realmente consomem vaga.
3. Não editar a contagem manualmente sem reconciliar as conversas causadoras.
4. Retomar somente abaixo de 10 por cinco minutos e sem inbound nos últimos dois.

## Erro crítico do Pedro

1. Mudar o modo para sombra ou desligado e assumir a conversa por humano.
2. Registrar revisão com evidência e classificar a falha.
3. Criar regra apenas como rascunho; publicar só após regressão aprovada.
4. Revogar a referência de secret se houver suspeita de vazamento.

## Privacidade e retenção

1. Abrir solicitação vinculada ao contato e conferir o prazo.
2. Aplicar eventual retenção legal antes da exclusão.
3. O worker deve excluir banco e objeto de Storage; remover só a linha não prova apagamento.
4. Concluir a solicitação somente com resultado auditável da fila de purge.

## Restauração

1. Manter a aplicação e os workers pausados.
2. Restaurar em ambiente isolado quando a plataforma oferecer esse recurso.
3. Verificar tenants, RLS, filas, idempotência e integridade dos eventos.
4. Reabrir primeiro inbound, depois IA assistida e por último campanhas.
