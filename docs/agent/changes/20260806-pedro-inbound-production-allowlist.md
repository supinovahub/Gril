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
  - `git diff --check` nos arquivos da mudança.
- Evidência observada: lint remoto sem erros; lint do app sem erros, com
  quatro avisos preexistentes em `src/app/app/campanhas/page.tsx`.
- Validações não executadas e motivo: o lint local não conectou porque o
  Postgres local/Docker não está disponível; o teste falhou ao detectar 19
  migrations duplicadas não versionadas de outro processo; o build compilou,
  mas falhou no typecheck da alteração paralela de `campaign_edit_requests`.
  Não foi feita homologação visual nem teste real de WhatsApp.

## Impacto operacional

- Deploy necessário: sim, para publicar a tela; a regra de segurança só fica
  ativa depois de aplicar a migration e publicar o código compatível.
- Migração aplicada: não. A migration aparece como pendente no Supabase
  remoto; nenhuma alteração externa foi executada.
- Compatibilidade/rollback: com a lista vazia, inbound normal em `production`
  não envia respostas automáticas. O rollback deve remover os novos gates via
  migration revisora, preservando a tabela existente de campanhas.

## Pendências e riscos

- Aplicar a migration de forma serializada após revisar as migrations pendentes
  dos outros agentes.
- Repetir lint local, `npm test` e `npm run build` em um worktree limpo.
- Homologar um número listado, um número fora da lista e a remoção de um
  número enquanto há execução pendente.

## Documentos relacionados

- Decisão: `docs/decisions/pedro-inbound-production-allowlist.md`.
- Guia de homologação: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
