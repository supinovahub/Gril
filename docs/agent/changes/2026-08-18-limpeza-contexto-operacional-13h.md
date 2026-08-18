# Nova limpeza de contexto operacional e call futura

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `ops/cleanup-arthur-rocha-13h`
- Commit: o commit que contém este arquivo

## Objetivo

Remover do Supabase canônico todo o contexto operacional recriado para o
contato indicado pelo usuário, incluindo explicitamente a call futura das 13h,
sem apagar configuração compartilhada nem a trilha de auditoria.

## Antes e depois

- Antes: existiam 1 contato, 1 telefone, 1 oportunidade, 1 conversa, 28
  mensagens, 11 execuções de IA, 1 call, 156 jobs, 32 eventos de outbox e 2
  objetos de áudio, além dos vínculos derivados.
- Depois: contato, telefone, oportunidade, conversa, mensagens, IA, call,
  qualificações, vínculos de campanha/importação, jobs, outbox e mídias
  relacionados retornaram zero. Um recibo imutável da limpeza permaneceu em
  auditoria.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão
  transacional no projeto Supabase canônico `frslhzwhaooqtivkzdez` e remoção
  de dois objetos pelo Storage API oficial. Nenhum deploy ou alteração de
  fornecedor externo foi executado.
- O alvo não usava o prefixo `HML-`; antes da rotina protegida, a operação
  exigiu unicidade do contato, ausência de outro contexto HML na organização e
  correspondência exata da call das 13h. O enquadramento temporário na rotina
  ocorreu dentro da mesma transação e o contato foi apagado no commit.

## Validação

- Comandos/testes executados: `git fetch origin`, preflight de concorrência,
  `npx supabase migration list --linked`, identificação agregada do alvo,
  preview em transação revertida, execução completa com `ROLLBACK`, execução
  final com `COMMIT`, remoção das mídias pela Storage API e consultas finais
  somente leitura.
- Evidência observada: o preview encontrou exatamente um contato e uma call
  futura às 13h, sem bloqueio ou referência cruzada. O ensaio e a execução
  final retornaram `status = purged`; a consulta posterior confirmou zero para
  contato, oportunidade, conversa, call, jobs, outbox e Storage, além dos
  demais conjuntos verificados. O recibo de auditoria foi criado e a auditoria
  anterior permaneceu preservada.
- A tentativa inicial com a CLI experimental de Storage concluiu sem remover
  objetos; a operação foi repetida pela API oficial, que confirmou os dois
  objetos removidos, e a consulta final ao catálogo retornou zero.
- Validações não executadas e motivo: lint, testes e build da aplicação não
  foram executados porque não houve mudança de código ou schema.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a exclusão é destrutiva e não possui rollback
  automático. Eventual recuperação dependeria da política externa de backup ou
  PITR disponível; a trilha de auditoria não foi removida.

## Pendências e riscos

- Provedores externos podem manter retenções próprias fora do Supabase.
- Um novo inbound futuro do mesmo número poderá criar um contexto novo, sem
  restaurar o histórico removido.

## Documentos relacionados

- Decisões atualizadas: nenhuma; nenhuma regra de produto mudou.
- Guia de homologação atualizado: não; o fluxo humano existente continua
  aplicável.
