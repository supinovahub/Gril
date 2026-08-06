# Whitelist do Pedro no inbound de produção

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir testes controlados do Pedro em produção, cadastrando números de
telefone que podem receber respostas automáticas no atendimento inbound
normal.

## Antes e depois

- Antes: a tabela e a tela de allowlist existiam para a reativação, mas o
  inbound normal em `production` não bloqueava destinatários fora da lista.
- Depois: o inbound normal (`journey = inbound`) só cria/roda execuções e
  insere mensagens outbound de IA para números ativos cadastrados na
  whitelist da organização. `shadow` e `assisted` continuam disponíveis fora
  da lista; a reativação mantém seu gate próprio.

## Escopo executado

- Arquivos: tela e actions de Pedro; decisão de produto; traceabilidade,
  runbook, checklist e guia de homologação.
- Migrations: `20260806165243_enforce_pedro_inbound_allowlist.sql`, com helper
  de consulta, revalidação no claim do worker, trigger final de outbound e
  auditoria da tabela.
- Testes SQL: `supabase/tests/phase_34_pedro_inbound_allowlist.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados:
  - `git fetch origin`;
  - `npx supabase migration list --linked`;
  - `npx supabase db lint --linked --fail-on error`;
  - `npm run lint`;
  - `npm test`;
  - `npm run build`;
  - `npx supabase db lint --local --fail-on error`;
  - `npx supabase db push --linked --yes` a partir de worktree limpo;
  - consulta remota de confirmação dos objetos da migration;
  - `npx --yes vercel@latest ... whoami`;
  - `npm ci`, `npm run lint`, `npm test` e `npm run build` em worktree limpo;
  - preview Vercel Git, promoção para produção e verificação de `/login`.
  - `git diff --check` nos arquivos da mudança.
- Evidência observada: migration `20260806165243` aplicada; helper, trigger
  outbound e trigger de auditoria confirmados no remoto; preview
  `gril-mn8qpctkr-brio5.vercel.app` ficou `READY`; produção
  `dpl_APSFrhXy7vtcrJBWDaN9g6KA6gq9` ficou `READY`; `/login` respondeu HTTP
  200.
- Validações não executadas e motivo: o lint local não conectou porque o
  Postgres local/Docker não está disponível; a homologação visual e o teste
  real de WhatsApp continuam pendentes. O worktree compartilhado também
  mantém alterações paralelas não incluídas neste release.

## Impacto operacional

- Deploy necessário: concluído. Produção aponta para
  `dpl_APSFrhXy7vtcrJBWDaN9g6KA6gq9`, alias `https://gril-lac.vercel.app`.
- Migração aplicada: sim, `20260806165243_enforce_pedro_inbound_allowlist.sql`.
- Compatibilidade/rollback: com a lista vazia, inbound normal em `production`
  não envia respostas automáticas. O rollback deve remover os novos gates via
  migration revisora, preservando a tabela existente de campanhas.

## Pendências e riscos

- Homologar um número listado, um número fora da lista e a remoção de um
  número enquanto há execução pendente.

## Documentos relacionados

- Decisão: `docs/decisions/pedro-inbound-production-allowlist.md`.
- Guia de homologação: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
