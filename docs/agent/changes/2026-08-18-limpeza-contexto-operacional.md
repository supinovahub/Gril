# Limpeza completa de contexto operacional solicitado

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `ops/cleanup-arthur-rocha-8321`
- Commit: o commit que contém este arquivo

## Objetivo

Remover do Supabase remoto todo o contexto operacional do contato de
homologação solicitado pelo usuário, sem registrar dados pessoais no
repositório e sem apagar configuração compartilhada ou auditoria imutável.

## Antes e depois

- Antes: existiam 1 contato, 1 telefone, 1 oportunidade, 1 conversa, 35
  mensagens, 14 execuções de IA, valores/solicitações/histórico de
  qualificação, 1 call, 284 jobs e 34 eventos de outbox, além de vínculos
  derivados.
- Depois: contato, telefone, oportunidade, conversa, mensagens,
  qualificações, IA, call, vínculos de campanha/importação, ingestões, jobs e
  outbox relacionados retornaram zero na verificação remota.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão
  transacional no projeto Supabase canônico `frslhzwhaooqtivkzdez`, usando a
  rotina protegida de limpeza já publicada. Nenhum deploy ou alteração em
  fornecedor externo foi executado.

## Validação

- Comandos/testes executados: `git fetch origin`, preflight de concorrência,
  `npx supabase migration list --linked`, identificação agregada do alvo,
  preview da limpeza com `ROLLBACK`, execução completa com `ROLLBACK`, execução
  final com `COMMIT` e consulta pós-operação.
- Evidência observada: o preview encontrou exatamente um contato e nenhum
  bloqueio ou referência cruzada; o ensaio retornou `status = purged`; a
  execução final retornou o mesmo recibo e a consulta posterior confirmou zero
  para todos os conjuntos relacionados. O evento de auditoria da limpeza foi
  criado e os eventos de auditoria anteriores foram preservados.
- Validações não executadas e motivo: lint, testes e build da aplicação não
  foram executados porque não houve mudança de código ou schema. Não havia
  anexo nem objeto de Storage relacionado ao alvo.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a exclusão é destrutiva e não possui rollback
  automático. Um novo inbound futuro do mesmo número poderá criar um contexto
  novo, sem restaurar o histórico removido.

## Pendências e riscos

- Provedores externos podem manter retenções próprias fora do Supabase.
- Não reutilizar o contexto removido para homologação; um novo teste deve criar
  um contexto novo e identificado pelo prefixo `HML-`.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não foi necessário alterar o fluxo humano.
