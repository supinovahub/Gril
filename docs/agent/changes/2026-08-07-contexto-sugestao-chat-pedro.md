# Contexto visível nas sugestões do Chat com Pedro

- Data: 07/08/2026
- Responsável: Codex
- Branch/PR: `fix/chat-pedro-suggestion-context-current`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir o Chat com Pedro para que uma sugestão `assisted` não apareça apenas
com a frase genérica de revisão. Cada proposta deve deixar claro qual mensagem
do lead originou a análise e, quando existir, qual era o resumo factual
anterior da conversa.

## Antes e depois

- Antes: o tópico persistia a resposta sugerida em metadata, mas exibia apenas
  “Analisei a conversa e preparei uma resposta para o lead...”; o contexto da
  análise não era mostrado.
- Depois: o tópico exibe o contexto resumido, a mensagem inbound exata que
  originou a execução e a resposta proposta, mantendo link para o Inbox e as
  ações de revisão no mesmo fluxo transacional.

## Escopo executado

- Arquivos: Chat com Pedro, estilos, decisão, guia de homologação, estado
  compartilhado e este registro.
- Migrations: `20260807130110_chat_pedro_suggestion_context.sql`, que atualiza
  o sincronizador, enriquece novas propostas e faz backfill das pendentes.
- Testes SQL: `supabase/tests/phase_37_chat_pedro_suggestion_context.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma
  alteração; foram feitas apenas consultas remotas de leitura.

## Validação

- Comandos/testes executados: `npm ci`, `npm run lint`, `npm test`, `npm run
  build` com as duas variáveis públicas do Supabase injetadas somente no
  processo, `git diff --check`, `npx supabase migration list --linked` e
  `npx supabase db lint --linked --fail-on error`.
- Evidência observada: lint aprovado; 18 arquivos e 99 testes aprovados; build
  aprovado com 46 rotas; lint remoto sem erros, somente avisos preexistentes;
  a migration nova aparece como local e pendente no dry-run/lista.
- Validações não executadas e motivo: lint/teste SQL local não puderam rodar
  porque o Postgres local/Docker não está disponível. O `db push --linked
  --dry-run` foi bloqueado pela divergência histórica já existente entre
  migrations remotas e arquivos locais; nenhuma correção automática de
  histórico foi feita. Homologação visual e operacional permanecem pendentes.

## Impacto operacional

- Deploy necessário: sim, publicar o bundle que renderiza o contexto e aplicar
  a migration antes da homologação real.
- Migração aplicada: não.
- Compatibilidade/rollback: a mudança é aditiva em `internal_messages.metadata`
  e preserva a frase, resposta e ações existentes. O rollback deve publicar
  uma migration revisora que restaure o sincronizador anterior; as chaves
  adicionais podem permanecer sem alterar o fluxo antigo.

## Pendências e riscos

- Aplicar a migration somente após alinhar a divergência histórica local/remota
  sem `migration repair` silencioso.
- Publicar o código e homologar uma sugestão pendente, uma nova sugestão e o
  caso sem resumo anterior.
- Confirmar visualmente que mensagens longas ficam legíveis e que nenhum anexo
  sensível é exibido fora do contexto já autorizado do Inbox.

## Documentos relacionados

- Decisão atualizada: `docs/decisions/chat-pedro-assisted-queue.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
