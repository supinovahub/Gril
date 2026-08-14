# Redesign integral da UI — Signal Workspace

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `agent/full-ui-redesign-v2`, derivada de `origin/fix/inbox-lead-context-tabs`; PR rascunho `#45`
- Commit: o commit que contém este arquivo

## Objetivo

Repaginar toda a interface do Gril com uma direção visual claramente diferente da tentativa anterior e materializar as decisões da reunião de 12/08/2026: fonte de verdade unificada, menos exposição técnica, Central de decisões, relatórios na Visão Geral e retirada das superfícies descartadas.

## Antes e depois

- Antes: direção quente `Ink, Paper, Signal`, sidebar de 264 px em grafite, serifas editoriais, muitos cartões e rótulos de 8–10 px; áreas redundantes continuavam visíveis.
- Depois: `Signal Workspace` frio e tipográfico, sidebar clara de 232 px, Geist, cobalto como acento, listas contínuas, texto operacional legível e navegação reduzida. Visão Geral, Conversas e Central foram reestruturadas; as demais telas receberam os mesmos tokens, controles e estados.

## Escopo executado

- Arquivos: tokens globais, metadata/PWA, shell desktop/mobile, primitives compartilhadas, autenticação, Visão Geral, Conversas, detalhe do lead, Central, Campanhas, Agenda, Equipe, Pedro, Empreendimentos, Simulador, CRM/Kanban, Perfil, fluxos auxiliares e administração de plataforma.
- Arquitetura: relatórios integrados ao Dashboard por contagens exatas sem transferência de tabelas completas; Conversas com acesso à visualização Kanban; Central com tópicos de Pedro e Lionel; Meta Cloud sem cadastro de formulário/pré-lead; redirecionamentos para Aprendizados, Experimentos A/B, Checklists, Privacidade e Relatórios.
- Migrations: nenhuma.
- Mudanças externas: branch `agent/full-ui-redesign-v2` publicada e PR rascunho `#45` aberto no GitHub; preview Vercel automática `dpl_DQUS8SNWhDp7iUke9TKfKV9wMZeg`, status `READY`, com alias `https://gril-git-agent-full-ui-redesign-v2-brio5.vercel.app`. Supabase e produção não foram alterados. A Taste Skill foi instalada apenas no runtime local do Codex; não virou dependência do repositório.

## Validação

- Comandos/testes executados: `git diff --check`, `npm run lint`, `npm test` e `npm run build` com o `.env.local` canônico não versionado.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Next.js 16.2.12 compilado, TypeScript concluído e 47 rotas geradas.
- QA visual: login, Dashboard, Conversas e Central renderizados com componentes reais em fixture local descartável; desktop com 1536 px sem overflow; breakpoint de 390 px com sidebar oculta, navegação mobile visível e conteúdo limitado ao viewport. As fixtures e a exceção pública foram removidas antes do commit.
- Preview: ambos os checks de qualidade e o deployment Vercel passaram; `/login` respondeu HTTP 200 no alias da branch. A identidade isolada foi confirmada como `suporteinovahub-7501` antes da inspeção.
- Validações não executadas e motivo: o fluxo autenticado com dados reais não pôde ser automatizado porque o Chrome estava bloqueado por uma UI de outra extensão; requer homologação na preview da branch.

## Impacto operacional

- Deploy necessário: a preview está disponível; promoção para produção somente após revisão/homologação. Produção não foi alterada.
- Migração aplicada: não.
- Compatibilidade/rollback: backend, schema, RLS, actions e rotas profundas permanecem; rollback é reverter o commit da UI. Rotas de superfícies retiradas preservam compatibilidade por redirecionamento.

## Pendências e riscos

- Homologar com dono, gestor e corretor na preview usando dados reais.
- Confirmar visualmente conversas longas, campanhas com muitos imports e tabelas administrativas em notebook de pouca altura.
- As duas vulnerabilidades altas já reportadas pelo `npm ci` permanecem fora do escopo desta mudança.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-12-ui-operacional-unificada.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
