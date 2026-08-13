# Auditoria UI/UX e arquitetura

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `agent/ui-architecture-audit`
- Commit: o commit que contém este arquivo

## Objetivo

Concluir a Fase 1 solicitada: auditar a arquitetura, navegação, carregamento do Inbox, padrões visuais e conflitos de produto antes de qualquer implementação.

## Antes e depois

- Antes: diagnóstico distribuído entre código, documentação e estado remoto, sem um plano único para a consolidação da interface.
- Depois: auditoria completa em `AUDITORIA_UI_UX_ARQUITETURA.md`, plano incremental em `PLANO_DE_REFATORACAO.md` e primeira fatia de UI implementada em commits posteriores nesta branch.

## Escopo executado

- Arquivos: `AUDITORIA_UI_UX_ARQUITETURA.md`, `PLANO_DE_REFATORACAO.md`, este registro e os arquivos de UI descritos nos commits posteriores.
- Migrations: nenhuma criada ou aplicada.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma. Foram feitas somente consultas de leitura ao Supabase remoto.

## Validação

- Comandos/testes executados:
  - `git status --short --branch` e `git fetch origin` no worktree original, preservando mudanças alheias;
  - worktree isolado baseado em `origin/phase/01-foundation`;
  - `npx supabase migration list --project-ref frslhzwhaooqtivkzdez`;
  - `npx supabase db query --linked --project-ref frslhzwhaooqtivkzdez` para metadados e planos representativos;
  - `npx supabase db advisors --linked --project-ref frslhzwhaooqtivkzdez --type performance --level info --fail-on none`;
  - `npm test`;
  - `npm run lint`;
  - `npm run build` com o ambiente local carregado apenas no processo.
- Evidência observada: 22 arquivos e 110 testes aprovados; lint aprovado; build gerou 46 rotas na auditoria e 47 rotas após a nova rota de Conversas; migrations remotas/locais alinhadas até `20260810140144` na base analisada; advisors retornaram 461 FKs sem índice e 67 índices sem uso como backlog informativo.
- Validações não executadas e motivo: não houve smoke test autenticado no navegador nem homologação com fornecedores reais, pois esta fase é diagnóstico e não altera a interface ou integrações.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a primeira implementação preserva as actions, tabelas e APIs; `/app/inbox` continua disponível; o worktree original com alterações de outros agentes não foi tocado. Cada fatia está em commit próprio/reversível.

## Pendências e riscos

- Aprovar as decisões bloqueadoras listadas na auditoria: aliases de Conversas, métricas do dashboard, significado de Produção/Revisão, mapeamento Corretor/Imobiliária e destino de Aprendizados/A-B, pré-lead, checklist e Privacidade.
- Não transformar os advisors gerais de performance em deleções de índices; investigar por domínio e plano.
- Medir o Inbox com trace autenticado e volume representativo antes de alterar view, índice ou paginação do banco.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; nenhum fluxo foi alterado.
