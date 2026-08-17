# Visão geral orientada a métricas com Kanban

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/dashboard-redesign-real`; PR rascunho
  [#46](https://github.com/supinovahub/Gril/pull/46)
- Commit: o commit que contém este arquivo

## Objetivo

Repaginar de fato a tela inicial do dashboard para priorizar leitura comercial,
reduzir informação técnica e trocar o funil resumido por uma visualização útil
do Kanban, preservando a identidade já usada em produção.

## Antes e depois

- Antes: a Visão geral destacava primeiros passos, acessos, operações visíveis e
  critérios técnicos do piloto; a hierarquia não ajudava o gestor a compreender
  o desempenho comercial rapidamente.
- Depois: a tela abre com quatro métricas e seletor de período, apresenta um
  snapshot das etapas reais do Kanban, limita atenção e agenda a três itens e
  recolhe a limpeza HML numa área administrativa.

## Escopo executado

- Arquivos: `src/app/app/page.tsx`, `src/app/app/dashboard.module.css`,
  `.superdesign/design-system.md`, decisão de produto, este registro e guia de
  homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: a branch foi
  publicada no GitHub, o PR rascunho #46 foi aberto e a integração Git da
  Vercel criou a preview
  `https://gril-git-agent-dashboard-redesign-real-brio5.vercel.app`. Nenhuma
  alteração foi feita no Supabase ou em produção.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`,
  `npx eslint src/app/app/page.tsx`, `npm run build -- --webpack`, verificação
  local da rota protegida com `agent-browser` e `git diff --check`.
- Evidência observada: lint sem erros; 22 arquivos e 110 testes passaram; o
  build compilou, concluiu TypeScript e gerou 46 páginas. A rota protegida
  redireciona para `/login?next=%2Fapp`; o navegador mantém o título
  `Entrar | Pedro` e o favicon `/icon.svg`. Na preview, os dois checks `quality`
  do GitHub passaram, o deployment ficou `Ready`, `/login` respondeu HTTP 200 e
  `/app` respondeu HTTP 307 para o login. A implementação autenticada ainda
  depende de homologação humana com dados reais.
- Validações não executadas e motivo: a homologação visual autenticada não usa
  credenciais criadas ou reaproveitadas automaticamente por um agente.

## Impacto operacional

- Deploy necessário: a preview foi publicada; produção não foi alterada.
- Migração aplicada: não.
- Compatibilidade/rollback: a mudança reutiliza tabelas, permissões, rotas e
  ações existentes. Reverter o commit restaura apenas a apresentação anterior.

## Pendências e riscos

- Homologar desktop e mobile com uma conta real, conferindo contagens, ordem das
  nove etapas e nomes dos responsáveis.
- Confirmar com dados representativos se as definições de taxa de resposta e
  conversão atendem à leitura comercial esperada.
- A preview possui proteção da Vercel; o homologador precisa entrar na Vercel
  antes de usar a autenticação normal do Gril.
- O build usou webpack porque o Turbopack 16.2.12 rejeita o junction local de
  `node_modules` apontando para fora do worktree; o bundle de produção foi
  concluído normalmente por esse caminho.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/dashboard-metricas-kanban.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
