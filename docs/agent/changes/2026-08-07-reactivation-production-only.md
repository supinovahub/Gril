# Production automatica exclusiva para reativacao

- Data: 07/08/2026
- Responsavel: Codex
- Branch/PR: `agent/reactivation-pedro-production`
- Commit: o commit que contem este arquivo

## Objetivo

Permitir a liberacao da resposta automatica do Pedro em production somente
para campanhas de reativacao de base.

## Antes e depois

- Antes: o atendimento normal ainda oferecia `production`, e a conversa criada
  pelo executor de campanha podia permanecer com `journey = inbound`.
- Depois: o inbound normal fica limitado a `off`, `shadow` e `assisted`;
  production exige campanha `reactivation`, configuracao de reativacao liberada,
  provenance da campanha e as revalidacoes de allowlist/opt-out/supressao.

## Escopo executado

- Arquivos: telas e server actions de Pedro e Campanhas; decisao, rastreabilidade
  e guia de homologacao atualizados.
- Migrations: `20260807180741_reactivation_production_only.sql` restaura os
  checks de inbound, adiciona gates de campanha/onda/worker/outbound e marca a
  conversa pela abertura da campanha.
- Testes: `supabase/tests/phase_38_reactivation_production_only.sql` cobre os
  constraints, triggers e funcoes principais.
- Mudancas externas em Supabase, Vercel, GitHub ou fornecedores: a migration
  `20260807180741` foi aplicada no projeto remoto `frslhzwhaooqtivkzdez` e sua
  history foi registrada; nenhum deploy Vercel foi feito.

## Validacao

- Comandos/testes executados:
  - ESLint nos quatro arquivos TypeScript/TSX alterados: passou.
  - Vitest: 20 arquivos e 106 testes passaram.
  - Next build com variaveis publicas dummy: compilacao e TypeScript passaram;
    a coleta/prerender falhou em `/app/conhecimento` com `Expected workStore to
    be initialized` no Next 16.2.12.
  - `npx supabase db lint --linked --fail-on error`: passou sem erro; retornou
    somente warnings preexistentes no schema remoto.
  - `npx supabase db lint --local --fail-on error`: nao executado porque o
    Docker/Postgres local nao estava disponivel em `127.0.0.1:54322`.

## Impacto operacional

- Deploy necessario: sim, junto com a migration.
- Migracao aplicada: sim, no Supabase remoto em 07/08/2026; nenhum dado de
  lead foi apagado ou alterado por esta migration.
- Compatibilidade/rollback: a migration normaliza configuracoes globais
  antigas de production para `assisted`; rollback exige uma decisao explicita,
  pois reabrir production no inbound contradiz esta regra atual.

## Pendencias e riscos

- Homologar uma campanha reactivation em `test_controlled` e depois `released`.
- Investigar o erro de prerender do Next em `/app/conhecimento` antes do build
  de release.
- Confirmar no dashboard de produção uma campanha de teste antes de habilitar
  qualquer campanha real.

## Documentos relacionados

- Decisoes atualizadas: `docs/decisions/reactivation-production-only.md`.
- Guia de homologacao atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
