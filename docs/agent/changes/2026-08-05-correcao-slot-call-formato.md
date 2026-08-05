# Preservação do horário confirmado da call

- Data: 05/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-slot-preservation-published`
- Commit: o commit que contém este arquivo

## Objetivo

Impedir que uma resposta estruturada do Pedro altere silenciosamente o horário escolhido pelo lead quando a mensagem seguinte apenas define o formato da call.

## Antes e depois

- Antes: a resposta textual dizia um horário já confirmado, mas a ação estruturada podia carregar outro horário; a segunda ação criava uma nova call e o trigger cancelava a anterior.
- Depois: o worker reaproveita o horário da call futura existente em confirmações apenas de vídeo/telefone. O banco atualiza o formato na call canônica e impede duas calls ativas no mesmo slot.

## Escopo executado

- Arquivos: `src/lib/ai/pedro-turn.ts`, `src/lib/runtime/worker.ts`, testes de `pedro-turn`, teste SQL `phase_32_call_slot_preservation` e guia de homologação.
- Migrations: `20260805184410_preserve_confirmed_call_slot.sql` cria índice único parcial para slots ativos e torna o trigger de criação idempotente por oportunidade/slot.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: migration aplicada no projeto Supabase `frslhzwhaooqtivkzdez`; branch publicada no GitHub; deployment de produção não executado porque o perfil Vercel canônico exigido pelo protocolo não existe neste host.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build`, `npx supabase db lint --linked --fail-on error`, `npx supabase db push --linked --dry-run` e teste de presença do índice/trigger no banco remoto.
- Evidência observada: 17 arquivos e 96 testes passaram; build TypeScript/Next concluído; migration aplicada; índice `calls_active_slot_unique_idx` e caminho `call.reused` confirmados no remoto; não havia duplicidades ativas antes da aplicação.
- Validações não executadas e motivo: não foi executado um cenário real de conversa para não criar nova call no lead de homologação; a regressão foi coberta por teste unitário e teste estrutural SQL.

## Impacto operacional

- Deploy necessário: sim, para publicar a normalização no worker; bloqueado neste host pela ausência do perfil Vercel canônico.
- Migração aplicada: sim, `20260805184410`.
- Compatibilidade/rollback: requests para calls em novos horários mantêm o fluxo existente; retries e confirmações de formato no mesmo slot reaproveitam a call. Rollback deve remover a aplicação do código somente junto de uma decisão explícita sobre o índice e trigger, pois a migration é aditiva.

## Pendências e riscos

- Publicar no alias de produção e confirmar que o deployment está `Ready` e que o worker carregou a nova versão.
- Homologar manualmente uma conversa em que o lead escolha o horário e, na mensagem seguinte, o formato.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção reforça a regra existente de banco como estado canônico.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
