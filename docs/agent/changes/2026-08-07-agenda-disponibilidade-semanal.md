# Editor semanal de disponibilidade na Agenda

- Data: 07/08/2026
- Responsável: Codex
- Branch/PR: `agent/agenda-ux-batch-availability`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que o corretor cadastre e ajuste sua disponibilidade recorrente sem registrar cada dia isoladamente.

## Antes e depois

- Antes: um formulário escolhia um dia, um horário e salvava um único período por vez; os períodos existentes não tinham edição ou remoção visível.
- Depois: um editor semanal permite selecionar vários dias, aplicar um horário de uma vez, usar modelos rápidos, manter mais de um período por dia, editar/remover períodos e salvar todas as mudanças em lote.

## Escopo executado

- Arquivos: `src/app/app/agenda/page.tsx`, `src/app/app/agenda/actions.ts`, `src/app/app/agenda/availability-editor.tsx`, `src/app/app/agenda/agenda.module.css`, `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados: lint completo; `vitest run`; `next build --webpack` com as variáveis públicas do `.env.local` carregadas sem exibição; `git diff --check`.
- Evidência observada: lint passou; 20 arquivos e 106 testes passaram; build compilou, concluiu o TypeScript e gerou 46 rotas.
- Validações adicionais: `tsc --noEmit` isolado ainda encontra dois erros preexistentes em `src/lib/ai/pedro-turn.test.ts`, fora do escopo; o TypeScript do build passou. Homologação visual e persistência real dependem de sessão autenticada e continuam pendentes.

## Impacto operacional

- Deploy necessário: sim, quando a branch for integrada.
- Migração aplicada: não.
- Compatibilidade/rollback: a estrutura existente de `availability_rules` é reutilizada; remoções desativam regras e preservam auditoria. Reverter o commit restaura a interface anterior.

## Pendências e riscos

- Confirmar em navegador a seleção múltipla, presets, edição, remoção, períodos divididos e bloqueio de sobreposição.
- Confirmar que uma alteração concorrente de disponibilidade solicita atualização da página, sem apagar mudanças de outra sessão.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a mudança implementa a disponibilidade semanal recorrente já prevista.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
