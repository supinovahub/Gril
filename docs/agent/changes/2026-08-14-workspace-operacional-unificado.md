# Redesign do workspace operacional

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/workspace-redesign-real` / PR a criar
- Commit: o commit que contém este arquivo

## Objetivo

Aplicar a direção visual aprovada às telas operacionais, reduzir a exposição da arquitetura técnica e eliminar entradas duplicadas para as mesmas entidades, preservando identidade de produção, dados reais e fluxos funcionais.

## Antes e depois

- Antes: Leads e Kanban apareciam como módulos independentes; Inbox, Pedro e Lionel disputavam entradas paralelas; a Central separava os eventos em vários painéis técnicos; Auditoria mostrava até 250 eventos de uma vez; várias telas começavam por explicações extensas.
- Depois: Conversas contém as visualizações de conversas e leads; o Kanban completo é aberto pelo resumo da Visão geral; Central apresenta um registro cronológico único com dez itens por página; Auditoria usa trinta itens por página; Agenda, Campanhas, Equipe, Pedro, Base de conhecimento e Simulador seguem a mesma hierarquia compacta.

## Escopo executado

- Arquivos: shell e navegação; Inbox e contexto do lead; lista e detalhe de Leads; Central; Pedro; Campanhas; Agenda; Equipe; Base de conhecimento; Simulador; Auditoria; estilos modulares; documentos de decisão e homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma até o registro deste arquivo. Produção e Supabase não foram alterados.
- Integração de trabalho: a branch foi criada sobre a mudança aprovada da Visão geral, integrou a frente funcional de Chat com Pedro e Lionel e reaproveitou a implementação anterior das abas de contexto do Inbox para preservar trabalho válido já existente.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build -- --webpack` com as variáveis locais carregadas apenas no processo.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Next.js 16.2.12 aprovado com TypeScript e 46 rotas; tela pública local renderizada sem overlay de erro.
- Validações não executadas e motivo: telas autenticadas não foram inspecionadas com dados reais porque o navegador disponível não possuía sessão para `localhost` e nenhuma credencial foi solicitada ou reutilizada. A homologação autenticada fica para a preview.

## Impacto operacional

- Deploy necessário: preview da branch para homologação; produção somente após aprovação e merge explícito.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas e actions foram mantidas. O rollback é o revert do commit/PR de interface.

## Pendências e riscos

- Homologar na preview, com dono/gestor e corretor, a navegação responsiva e as ações com dados reais.
- Confirmar visualmente que a Central respeita o recorte de operação e que a paginação de dez registros atende o volume real.
- As rotas retiradas da navegação continuam acessíveis por URL neste ciclo; remoção funcional exige decisão e auditoria separadas.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
