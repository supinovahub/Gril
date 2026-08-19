# Ordenação cronológica das conversas

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/chat-chronological-order`; PR não aberto nesta etapa
- Commit: o commit que contém este arquivo

## Objetivo

Remover a promoção de conversas com pendências no Inbox e apresentar a lista
pela atividade mais recente, como no WhatsApp.

## Antes e depois

- Antes: mensagens inbound não lidas ou sugestões da IA pendentes promoviam a
  conversa para o topo. A prioridade era aplicada ao selecionar as 100 linhas e
  novamente ao serializar o bootstrap, podendo retirar conversas mais recentes
  da página.
- Depois: todas as conversas são selecionadas e exibidas por
  `updated_at DESC, id`; pendências continuam visíveis nos mesmos badges e
  contadores, sem alterar a posição da conversa.

## Escopo executado

- Arquivos: página do Inbox, utilitário e teste de ordenação, decisão nova e
  decisão substituída, guia de homologação, teste pgTAP, migration e este
  registro.
- Migrations: `20260819123017_inbox_chronological_order.sql`, criada pelo
  Supabase CLI e não aplicada nesta etapa.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma
  mudança persistente. O Supabase canônico foi consultado somente para confirmar
  migrations, definições atuais, configurações das funções e índices; o GitHub
  foi consultado somente para conferir PRs abertos. Não houve deploy, push ou
  alteração de dados.

## Validação

- Comandos/testes executados: teste direcionado do comparador; `npm run lint`;
  `npm test`; `npm run build`; `npx tsc --noEmit --pretty false`;
  `npx supabase migration list --linked`; `npx supabase db push --linked
  --dry-run`; `npx supabase db lint --linked --fail-on error`; consultas de
  leitura em `pg_proc`/`pg_indexes`; `git diff --check`.
- Evidência observada: 2/2 testes direcionados e 24 arquivos/117 testes da suíte
  passaram; lint completo passou; o build Next.js 16.2.12 compilou, concluiu a
  checagem TypeScript e gerou 46 rotas. O dry-run identificou somente a migration
  nova e declarou explicitamente que nada seria aplicado. O db lint remoto não
  encontrou erros e repetiu apenas avisos históricos. Antes da migration nova,
  o histórico local e remoto estava alinhado até `20260818170835`.
- Validações não executadas e motivo: o teste pgTAP novo não foi executado porque
  o host não possui Docker/Podman para o banco local. A homologação visual
  autenticada não foi executada porque não houve preview nem deploy. O
  `tsc --noEmit` isolado reproduziu somente três erros preexistentes em
  `pedro-turn.test.ts` e `openai-runtime.test.ts`; o build da aplicação passou.

## Impacto operacional

- Deploy necessário: sim, depois de merge na branch canônica; não realizado.
- Migração aplicada: não.
- Compatibilidade/rollback: payload, campos, permissões, RLS e limite permanecem
  iguais. Reversão exige nova migration forward-only restaurando a ordenação
  anterior e reversão do rótulo/comparador; nenhum dado precisa ser convertido.

## Pendências e riscos

- Aplicar a migration de forma serializada somente após conferir novamente o
  histórico linked e integrar a branch canônica atualizada.
- Homologar com uma conversa recente sem pendência e conversas antigas com
  mensagem não lida/sugestão pendente, confirmando que badges permanecem e não
  promovem as conversas antigas.
- Confirmar no ambiente autenticado que o Inbox aquecido continua abaixo de um
  segundo após a mudança de ordenação.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-19-inbox-chronological-order.md`
  substitui `docs/decisions/inbox-attention-order.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
