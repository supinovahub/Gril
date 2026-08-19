# Correção do relógio de atividade da Inbox

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/inbox-activity-timestamp`; PR a registrar
- Commit: o commit que contém este arquivo

## Objetivo

Fazer a lista de Conversas ordenar e exibir o horário da última mensagem real,
como no WhatsApp, sem confundir alterações operacionais da conversa com nova
atividade do contato.

## Antes e depois

- Antes: a lista usava `conversations.updated_at`. Uma atualização em lote de
  modo, responsável, pausa ou outro metadado podia atribuir o mesmo horário a
  várias conversas e colocar uma conversa antiga acima de outra recente.
- Depois: o RPC usa `messages.created_at` da última mensagem, com
  `conversations.started_at` apenas para conversas sem mensagens. O mesmo valor
  ordena a lista e aparece no card; pendências e metadados não mudam a posição.

## Escopo executado

- Arquivos: migration do RPC, índice de atividade, teste pgTAP, esclarecimento
  no utilitário/teste unitário, decisão de produto e guia de homologação.
- Migrations: `20260819132358_inbox_message_activity_order.sql`, criada pelo
  Supabase CLI; aplicação remota a registrar após o merge.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: a registrar
  após publicação.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test` (117 testes);
  `npm run build`; `npx supabase db push --linked --dry-run`; e
  `npx supabase db lint --linked --level warning`.
- Evidência observada: a consulta viva mostrou conversas com mensagens em dias
  diferentes recebendo o mesmo `conversations.updated_at` após uma atualização
  operacional em lote; `messages.created_at` permaneceu coerente com o horário
  exibido no histórico de cada conversa.
- Validações não executadas e motivo: o pgTAP local não foi executado porque o
  host não possui o runtime de containers necessário; o teste foi adicionado
  para execução em ambiente Supabase compatível. A confirmação autenticada em
  produção será registrada depois da publicação.

## Impacto operacional

- Deploy necessário: sim, após merge na branch canônica.
- Migração aplicada: não nesta etapa.
- Compatibilidade/rollback: o formato do payload, as permissões e o limite de
  100 conversas permanecem iguais. Reversão exige uma nova migration adiante;
  nenhum dado de conversa ou mensagem é reescrito.

## Pendências e riscos

- Revalidar imediatamente o histórico linked antes da aplicação serializada.
- Confirmar em produção que o card mostra o horário da última mensagem e que
  uma conversa recente aparece acima de uma antiga.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-inbox-chronological-order.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
