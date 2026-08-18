# Production inbound condicionada à whitelist

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `feat/inbound-whitelist-production`
- Commit: o commit que contém este arquivo

## Objetivo

Restaurar o modo `production` no atendimento inbound normal sem ativá-lo ao
cadastrar um número e sem permitir respostas automáticas fora da whitelist.

## Antes e depois

- Antes: o banco limitava o inbound a `off`, `shadow` e `assisted`; o dashboard
  não mostrava **Responde automaticamente**, mesmo com número allowlisted.
- Depois: a presença de ao menos um número ativo faz o modo aparecer, mas o
  dono ainda precisa selecioná-lo. Execução, worker e outbound continuam
  bloqueados para qualquer destinatário fora da lista.

## Escopo executado

- Arquivos: tela e Server Action de Pedro, helper/teste da visibilidade dos
  modos, decisão de produto, traceabilidade e guia de homologação.
- Migrations: `20260818162655_enable_allowlisted_inbound_production.sql` restaura
  o valor `production`, preserva os gates de prontidão, exige whitelist ativa
  para a transição e combina as travas finais de inbound e reativação.
- Testes SQL: `supabase/tests/phase_44_inbound_whitelist_production.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: serão
  registradas após aplicação e publicação.

## Validação

- Comandos/testes executados: `npm test` (24 arquivos e 117 testes), ESLint
  completo sem cache, `npm run build`, `git diff --check`,
  `npx supabase migration list --linked`,
  `npx supabase db lint --linked --fail-on error` e
  `npx supabase db push --linked --dry-run`.
- Evidência observada: todos os testes passaram, o lint não encontrou erros e
  o build do Next.js 16.2.12 compilou e validou 46 rotas. O banco local/remoto
  estava alinhado até `20260818153716`; o dry-run selecionou somente
  `20260818162655_enable_allowlisted_inbound_production.sql`. O lint remoto
  manteve apenas avisos preexistentes.
- Validações não executadas e motivo: a homologação visual e o envio real pelo
  WhatsApp permanecem sob responsabilidade do usuário.

## Impacto operacional

- Deploy necessário: sim, código e migration juntos.
- Migração aplicada: ainda não neste registro inicial.
- Compatibilidade/rollback: voltar o inbound para `assisted`, restaurar os
  checks anteriores e o guard final de reativação; a whitelist e a auditoria
  são preservadas.

## Pendências e riscos

- Aplicar e validar a migration no Supabase remoto serialmente.
- Publicar o bundle a partir da branch canônica e confirmar a rota pública.
- Homologar visualmente a exibição condicional do quarto modo e um novo áudio
  com o inbound explicitamente colocado em `production`.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-18-inbound-production-condicionada-a-whitelist.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
