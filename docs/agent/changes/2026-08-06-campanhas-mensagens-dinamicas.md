# Campanhas com mensagens dinâmicas por lead

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feat/campaign-dynamic-messages`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que campanhas de reativação usem variações de abertura orientadas ao
mesmo objetivo — investir ou morar em um studio — usando os dados já presentes
na planilha de leads.

## Antes e depois

- Antes: a importação enviava apenas nome e telefone; todos os contatos usavam
  uma única abertura.
- Depois: os campos extras são preservados, a campanha aceita três templates e,
  na liberação de cada onda, os contatos elegíveis alternam entre aberturas
  distintas. Preview/envio renderizam os mesmos dados.

## Escopo executado

- Arquivos: parser/decodificador CSV, action e tela de campanhas, renderer e
  testes unitários, tipos gerados, decisão de produto e guia de homologação.
- Migrations: `20260806202829_campaign_dynamic_messages.sql` adiciona o pack
  de variações, renderização no banco, distribuição determinística e uso no
  executor. As migrations remotas `20260806165000`, `20260806170711` e
  `20260806180518` também foram restauradas localmente para alinhar o histórico;
  elas não foram alteradas.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.
  A migration não foi aplicada remotamente.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build`,
  `npx supabase db lint --linked --schema public,private --level error
  --fail-on error`.
- Evidência observada: lint sem erros; 19 arquivos e 103 testes aprovados;
  build produziu 46 rotas; lint remoto sem erros.
- Validações não executadas e motivo: a migration ainda não foi aplicada nem
  executada em um banco local; antes da reconciliação, o dry-run era bloqueado
  pelas três versões remotas ausentes. Após restaurá-las, o dry-run passou e
  listou somente `20260806202829_campaign_dynamic_messages.sql`.

## Impacto operacional

- Deploy necessário: sim, após reconciliar migrations e integrar a branch.
- Migração aplicada: não.
- Compatibilidade/rollback: campanhas antigas usam a abertura anterior; o
  rollback de código deve ser acompanhado da reversão da migration após
  interromper novas campanhas com variações.

## Pendências e riscos

- Confirmar na homologação que uma onda com vários contatos gera alternância
  de templates e que textos/IDs duplicados são recusados na criação.
- Homologar com uma base sintética: três mensagens diferentes, objetivo,
  entrada e parcela corretos, campos ausentes com fallback, opt-out e
  revalidação no
  momento do envio.
- A build em worktree isolada mostrou apenas o aviso conhecido de múltiplos
  lockfiles; o TypeScript e a geração das rotas foram aprovados.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/campaign-dynamic-messages.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
