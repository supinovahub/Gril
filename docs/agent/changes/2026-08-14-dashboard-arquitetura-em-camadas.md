# Dashboard com arquitetura em camadas

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/workspace-redesign-real` / PR #47
- Commit: o commit que contém este arquivo

## Objetivo

Transformar a repaginação do dashboard em uma mudança real de arquitetura da informação, aplicando a auditoria do plugin oficial de Product Design sem alterar identidade, dados ou contratos operacionais.

## Antes e depois

- Antes: navegação longa com todos os módulos no mesmo nível; Visão geral aberta em Hoje, métricas isoladas em cartões, Kanban com rolagem horizontal e estado do Pedro/equipe misturado às pendências.
- Depois: trabalho frequente em primeiro nível e Gestão, Inteligência e Administração progressivos; Visão geral aberta em sete dias, faixa única de resultados, Kanban compacto de estoque atual com todas as contagens visíveis e próximas ações em camada inferior.

## Escopo executado

- Arquivos: `src/app/app/page.tsx`, `src/app/app/dashboard.module.css`, `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/app-shell.module.css`, `src/components/app-shell/nav-group.tsx`, documentação de decisão, estado e homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma durante a implementação. A continuação ocorre na branch e no PR já existentes.
- Coordenação: o preflight encontrou worktrees históricos com sobreposição de caminhos; a branch atual é a continuação explicitamente solicitada do PR #47, e nenhuma branch rejeitada ou trabalho externo foi integrado.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npx next build --webpack` e `git diff --check`.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Webpack do Next.js 16.2.12 compilou, validou TypeScript e gerou 46 rotas; diff sem erro de whitespace.
- Observação de ambiente: a primeira coleta de páginas do build parou porque este worktree não contém `.env.local`; a repetição carregou em memória o arquivo local já existente no workspace original, sem exibir, copiar ou versionar segredos, e foi concluída.
- Validações não executadas e motivo: QA visual autenticado desta rodada permanece para homologação da preview; nenhuma ação foi executada em produção ou no banco único.

## Impacto operacional

- Deploy necessário: atualização da preview do PR #47; produção não autorizada.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas, permissões, server actions, consultas e links profundos foram preservados; rollback é o revert do commit de interface e documentação.

## Pendências e riscos

- Homologar a hierarquia com dados reais em desktop e celular após a preview ser atualizada.
- A configuração de callback WhatsApp com base local já conhecida permanece fora deste escopo.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
