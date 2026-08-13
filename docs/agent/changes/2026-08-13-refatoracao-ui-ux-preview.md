# Refatoração UI/UX — corte de preview

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `preview/ui-ux-20260813`
- Commit: `756f8e2` (`chore(ux): preparar preview da nova interface`)

## Objetivo

Avançar a primeira fatia da refatoração UI/UX até um corte visual navegável,
com linguagem compartilhada entre Dashboard, Conversas e shell, preservando as
consultas, actions, APIs, regras de autorização e integrações existentes.

## Antes e depois

- Antes: ações e abas principais dependiam de estilos locais diferentes e os
  estados vazios não tinham um contrato visual comum.
- Depois: tokens de foco, espaçamento e interação foram consolidados; ações,
  cartões, abas, campos e estados vazios têm primitives compartilhadas; Gril é
  apresentado como produto no shell e Pedro permanece como capacidade de IA.

## Escopo executado

- Arquivos: `src/app/globals.css`, `src/components/ui/*`,
  `src/components/app-shell/app-shell.tsx`,
  `src/app/app/page.tsx` e `src/app/app/conversas/page.tsx`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta
  etapa; a exceção de concorrência autorizada pelo usuário não alterou outras
  worktrees ou branches.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build`,
  `git diff --check`.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build
  aprovado com 47 rotas, carregando as variáveis locais apenas no processo.
- Validações não executadas e motivo: preview autenticado e smoke visual ainda
  pendentes nesta etapa; serão executados antes da aprovação do corte.

## Impacto operacional

- Deploy necessário: não para a mudança local; preview separado será criado
  apenas para avaliação, sem promoção para produção.
- Migração aplicada: não.
- Compatibilidade/rollback: ações, consultas, rotas, RLS e contratos de
  backend foram preservados; rollback é reverter esta fatia visual.

## Pendências e riscos

- Homologar a navegação autenticada em desktop e mobile.
- Confirmar a direção visual antes de migrar as demais superfícies.
- O preflight identificou branches paralelas com arquivos sobrepostos; por
  autorização explícita do usuário, esta tarefa segue isolada e não integra,
  limpa ou modifica essas branches.

## Documentos relacionados

- Decisões atualizadas: nenhuma; não houve nova regra de produto.
- Guia de homologação atualizado: não; o fluxo funcional existente continua
  acessível e o preview será avaliado antes de ampliar a migração.

## Atualização de publicação — 13/08/2026

- A branch `preview/ui-ux-20260813` foi publicada em `origin` no commit
  `756f8e266bceaf98dc01ec6dd76cc18e1ac31bda`.
- A Vercel concluiu o preview no deployment
  `dpl_2kQwUJpwJSatecHkDwX1gej34L8r`, com status `Ready`.
- URL: `https://gril-mxc84z541-brio5.vercel.app`.
- Alias da branch: `https://gril-git-preview-ui-ux-20260813-brio5.vercel.app`.
- `https://gril-mxc84z541-brio5.vercel.app/login` respondeu HTTP 200.
- Nenhuma migration, dado, configuração de produção ou alias de produção foi
  alterado. A homologação autenticada e o smoke visual continuam pendentes.
