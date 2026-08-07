# Separação de campanhas arquivadas na listagem

- Data: 07/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: não criado; a árvore já continha alterações não commitadas da frente de campanhas

## Objetivo

Impedir que campanhas arquivadas apareçam na aba de campanhas ativas.

## Antes e depois

- Antes: a listagem podia incluir uma campanha arquivada junto das demais campanhas.
- Depois: a consulta e a renderização separam campanhas usando `status` e `archived_at`; a campanha arquivada só aparece na aba “Arquivadas”.

## Escopo executado

- Arquivos: `src/app/app/campanhas/page.tsx`, `src/lib/campaigns/view.ts`, `src/lib/campaigns/view.test.ts`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma. A migration de arquivamento remota foi apenas consultada.

## Validação

- Comandos/testes executados: `npm test`, `npm exec -- eslint src`, `npm run build`, `npm exec -- vitest run src/lib/campaigns/view.test.ts --run`, `git diff --check`.
- Evidência observada: 75 arquivos e 409 testes passaram; o teste da separação passou com 3 testes; o lint do código-fonte passou; o build compilou e gerou 46 rotas.
- Validações não executadas e motivo: `npm run lint` amplo não concluiu dentro do limite por atravessar as worktrees/artefatos compartilhados; `eslint src` passou como validação equivalente. Homologação visual permanece pendente do usuário.

## Impacto operacional

- Deploy necessário: sim; concluído posteriormente no registro `2026-08-07-publicacao-separacao-campanhas.md`.
- Migração aplicada: não.
- Compatibilidade/rollback: alteração restrita à leitura da listagem; rollback removendo o filtro e o helper/teste, sem alteração de dados.

## Pendências e riscos

- Homologar manualmente as abas “Ativas” e “Arquivadas” com uma campanha arquivada e uma não arquivada.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; o fluxo de teste existente continua aplicável.
