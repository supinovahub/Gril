# Correção do redesign das rotas operacionais

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/workspace-redesign-real` / PR `#47`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a entrega visual que havia alterado principalmente a aparência de algumas rotas sem reorganizar de fato sua experiência. A revisão foi iniciada depois de uma inspeção autenticada da preview com uma conta de dono, que confirmou a diferença entre o Dashboard reconstruído e telas ainda muito próximas da composição anterior.

## Antes e depois

- Antes: Agenda, Campanhas, Equipe, Base, Simulador, Organização e WhatsApp mantinham grande parte da hierarquia anterior; Kanban não havia sido reconstruído; Pedro ainda expunha vários editores longos de uma vez.
- Depois: as rotas passam a começar pelo estado real da operação, usam navegação interna e listas contínuas, apresentam o Kanban completo como workspace comercial e escondem configurações avançadas em disclosure progressivo. A paleta, o favicon e o título continuam iguais aos de produção.

## Escopo executado

- Arquivos: Kanban e estilos de Leads; Agenda; Campanhas; Equipe; Base de conhecimento; Simulador; Organização; Pedro; WhatsApp; estilos compartilhados e roteiro de homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: apenas atualização da branch e da preview do PR `#47`; produção e Supabase não foram alterados.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npx next build --webpack` com variáveis locais carregadas somente no processo.
- Evidência observada: lint aprovado; 22 arquivos de teste e 110 testes aprovados; build Next.js 16.2.12 aprovado com TypeScript e 46 rotas. O build padrão com Turbopack foi tentado, mas o bundler recusou o symlink de `node_modules` do worktree; o fallback Webpack é uma opção oficial desta versão do Next.
- Validações não executadas e motivo: a segunda rodada autenticada em desktop e celular depende da preview atualizada pelo novo commit. O login local com a conta fornecida não foi aceito pelo ambiente local; nenhuma credencial foi persistida e nenhuma ação de dados foi executada.

## Impacto operacional

- Deploy necessário: somente preview para homologação; produção continua dependendo de aprovação e merge explícitos.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas, Server Actions, permissões e contratos de dados foram preservados. O rollback é o revert do commit/PR de interface.

## Pendências e riscos

- Repetir a inspeção autenticada na preview atualizada, em desktop e celular, sem submeter formulários ou alterar dados reais.
- Confirmar visualmente os estados com pouco conteúdo e conteúdo extenso, especialmente Kanban, Agenda, Pedro e WhatsApp.

## Documentos relacionados

- Decisões atualizadas: nenhuma nova decisão de produto; permanece `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
