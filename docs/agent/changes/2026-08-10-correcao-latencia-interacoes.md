# Correção da latência nas interações do app

- Data: 10/08/2026
- Responsável: Codex
- Branch/PR: `mathdias2020/Bugfix-atrasoclick`
- Commit: o commit que contém este arquivo

## Objetivo

Remover a sensação de travamento causada por atualizações server-side
contínuas enquanto a pessoa navega ou executa ações no app autenticado.

## Antes e depois

- Antes: Inbox e chats executavam `router.refresh()` a cada 2,5 segundos; além
  disso, qualquer evento Realtime em uma das onze tabelas podia refrescar a
  rota atual, inclusive telas que não precisavam de dados ao vivo. Refreshs
  podiam se sobrepor a navegações e Server Actions.
- Depois: o refresh é exclusivamente orientado a eventos Realtime, com debounce
  de 300 ms, visibilidade da aba e apenas nas telas que consomem aquelas tabelas.
  As demais telas deixam de manter assinatura/refresh em segundo plano. O
  segmento autenticado também ganhou loading UI para responder imediatamente à
  navegação enquanto dados dinâmicos chegam.

## Escopo executado

- Arquivos: `src/components/app-shell/realtime-refresh.tsx`,
  `src/app/app/loading.tsx`, `src/app/app/loading.module.css` e o checklist
  operacional.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados: lint direcionado; `npm.cmd run lint`;
  `npm.cmd test`; `npm.cmd run build`; `git diff --check` no encerramento.
- Evidência observada: lint direcionado e lint completo passaram; 20 arquivos e
  106 testes passaram; o build de Next.js 16.2.12 compilou, concluiu TypeScript
  e gerou 46 rotas.
- Validações não executadas e motivo: homologação autenticada e medição visual
  de cliques ainda dependem de sessão e ambiente com variáveis reais; o CLI
  `agent-browser` não está instalado neste host. O primeiro build foi
  bloqueado pelo download das fontes Google no sandbox e passou na segunda
  tentativa com rede autorizada.

## Impacto operacional

- Deploy necessário: sim, quando a branch for integrada; não houve deploy nesta
  tarefa.
- Migração aplicada: não.
- Compatibilidade/rollback: a atualização ao vivo continua disponível nas telas
  de Inbox, Chat, Central, Agenda, Campanhas e pipeline; reverter o commit
  restaura o polling e remove o loading UI. Nenhum dado é alterado.

## Pendências e riscos

- Homologar com sessão autenticada a troca rápida entre abas, envio de ação e
  chegada de evento Realtime em Inbox, Chat, Agenda e Central.
- Confirmar em produção que a assinatura Realtime de cada tela usa somente as
  tabelas necessárias e que badges continuam atualizados ao navegar.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção implementa o comportamento de
  responsividade e Realtime já previsto.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
