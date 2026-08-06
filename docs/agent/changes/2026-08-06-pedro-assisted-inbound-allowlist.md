# Whitelist do Pedro limitada ao modo production

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir o bloqueio indevido de mensagens inbound do Pedro em modo `assisted`
quando o telefone não estava cadastrado na whitelist.

## Antes e depois

- Antes: `private.is_conversation_ai_eligible` exigia whitelist para qualquer
  conversa inbound, inclusive `assisted` e `shadow`.
- Depois: a whitelist é exigida na elegibilidade somente quando o inbound está
  em `production`. A revalidação de uma execução enfileirada e o trigger final
  de outbound permanecem limitados a `production`.

## Escopo executado

- Migration: `20260806193000_allow_assisted_inbound_ai.sql`.
- Teste SQL: `supabase/tests/phase_36_assisted_inbound_allowlist.sql`.
- Documentação: estado compartilhado e guia de homologação.
- Nenhuma alteração de interface, segredo ou configuração de fornecedor.

## Validação

- `git fetch origin` e `npx supabase migration list --linked` executados.
- A migration foi aplicada no Supabase remoto dentro de transação e registrada
  como `20260806193000`.
- Teste pgtap remoto executado com rollback.
- A conversa de homologação consultada retornou `ai_eligible = true` em
  `assisted` sem whitelist.
- Guards de claim e outbound para `production` permaneceram presentes no banco.
- `npx supabase db push --linked --dry-run` não pôde ser usado porque o
  histórico local já não contém a versão remota
  `20260806170711_campaign_edit_archive`; essa divergência foi preservada e
  não foi reparada silenciosamente.

## Impacto operacional

- Não foi necessário novo deployment Vercel: a correção está na função SQL
  usada pelo worker.
- Mensagens futuras em `assisted` poderão gerar sugestão normalmente sem
  whitelist; elas continuam sem envio automático até aprovação humana.
- Inbound em `production` continua exigindo telefone allowlisted antes de
  criar/iniciar a execução e antes de inserir outbound de IA.
