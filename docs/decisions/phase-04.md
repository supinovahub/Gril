# Fase 4 — filas, agenda e capacidade

## Escopo entregue

- dez Supabase Basic Queues duráveis no schema `pgmq`, fora da Data API;
- envelope versionado para eventos da outbox;
- dispatcher de outbox a cada minuto via Supabase Cron;
- `scheduled_jobs` como única agenda futura, com lease e `FOR UPDATE SKIP LOCKED`;
- retry exponencial, limite de tentativas, estado dead e alerta persistente;
- idempotência privada por escopo/chave/hash;
- pausas sistêmicas, saúde de integrações, alertas e notificações;
- reserva atômica de capacidade por operação e snapshots de métricas.

## Regras de capacidade

1. Abaixo de 25 conversas ativas, inbound e proativas são admitidas.
2. Ao atingir 25, campanhas, reativação e follow-ups proativos ficam pausados; inbound ainda entra.
3. Aos 30, inbound vira backlog prioritário sem consumir vaga.
4. Uma conversa já reservada não duplica a contagem.
5. Conversa dormindo ou liberada reduz a contagem.
6. Proativas só retomam quando a contagem fica abaixo de 10 por cinco minutos e não houve inbound nos dois minutos anteriores.

## Gate da fase

- job vencido é leased e aparece em `scheduled-actions`;
- dedupe parcial impede dois jobs ativos com o mesmo efeito;
- reserva proativa aos 25 retorna `proactive_paused`;
- reserva inbound aos 30 retorna `backlog`;
- Queues permanecem sem exposição a `anon` e `authenticated`;
- Cron está agendado para outbox, jobs e reconciliação.

