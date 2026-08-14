# Redesign do workspace operacional

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/workspace-redesign-real` / PR `#47`
- Commit: o commit que contém este arquivo

## Objetivo

Aplicar a direção visual aprovada às telas operacionais, reduzir a exposição da arquitetura técnica e eliminar entradas duplicadas para as mesmas entidades, preservando identidade de produção, dados reais e fluxos funcionais.

## Antes e depois

- Antes: Leads e Kanban apareciam como módulos independentes; Inbox, Pedro e Lionel disputavam entradas paralelas; a Central separava os eventos em vários painéis técnicos; Auditoria mostrava até 250 eventos de uma vez; várias telas começavam por explicações extensas.
- Depois: Conversas contém as visualizações de conversas e leads; o Kanban completo é aberto pelo resumo da Visão geral; Central apresenta um registro cronológico único com dez itens por página; Auditoria usa trinta itens por página; as demais rotas operacionais começam por métricas ou estado real, usam navegação interna e recolhem formulários avançados quando apropriado.

## Escopo executado

- Arquivos: shell e navegação; Inbox e contexto do lead; lista e detalhe de Leads; Kanban completo; Central; Pedro; Campanhas; Agenda; Equipe; Base de conhecimento; Simulador; Organização; WhatsApp; Auditoria; estilos modulares; documentos de decisão e homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: branch publicada e PR rascunho `#47` criado no GitHub; preview automática `https://gril-git-agent-workspace-redesign-real-brio5.vercel.app` concluída como `Ready`. Produção e Supabase não foram alterados.
- Integração de trabalho: a branch foi criada sobre a mudança aprovada da Visão geral, integrou a frente funcional de Chat com Pedro e Lionel e reaproveitou a implementação anterior das abas de contexto do Inbox para preservar trabalho válido já existente.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npx next build --webpack` com as variáveis locais carregadas apenas no processo.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Next.js 16.2.12 aprovado com TypeScript e 46 rotas; tela pública local renderizada sem overlay de erro.
- Validações não executadas e motivo: a primeira inspeção autenticada da preview comprovou quais rotas ainda estavam superficiais e originou a correção registrada em `2026-08-14-correcao-redesign-rotas-operacionais.md`. A segunda rodada autenticada fica para a preview reconstruída com o novo commit.

## Impacto operacional

- Deploy necessário: preview da branch pronta para homologação; produção somente após aprovação e merge explícito.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas e actions foram mantidas. O rollback é o revert do commit/PR de interface.

## Pendências e riscos

- Homologar na preview protegida, com dono/gestor e corretor, a navegação responsiva e as ações com dados reais.
- Confirmar visualmente que a Central respeita o recorte de operação e que a paginação de dez registros atende o volume real.
- As rotas retiradas da navegação continuam acessíveis por URL neste ciclo; remoção funcional exige decisão e auditoria separadas.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
