# Chat com Pedro recebe sugestões assisted por lead

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `fix/chat-pedro-assisted-suggestions`
- Commit: o commit que contém este arquivo

## Objetivo

Fazer o Chat com Pedro funcionar como intermediário operacional entre a IA e
o dono/gestor, exibindo sugestões `assisted` contextualizadas por lead em vez
de limitar o chat a tópicos genéricos e escaladas isoladas.

## Antes e depois

- Antes: `ai_suggestions` aparecia somente no detalhe da conversa do Inbox; o
  Chat com Pedro consultava apenas `internal_threads` e não mostrava a
  resposta proposta nem a ação pendente.
- Depois: cada conversa com sugestão `assisted` possui um tópico contextual,
  com resposta exata, link para o Inbox, edição e ações de aprovação, ensino e
  descarte usando o mesmo fluxo transacional existente.

## Escopo executado

- Arquivos: Chat com Pedro, ações do chat, estilos, decisão, guia de
  homologação, estado corrente e este registro.
- Migrations: `20260806165000_chat_pedro_assisted_queue.sql`, adicionando a
  origem do tópico, sincronização de sugestões pendentes e atualização após a
  revisão humana.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma
  nesta etapa; a migration ainda não foi aplicada remotamente e não houve
  deploy.

## Validação

- Comandos/testes executados: `npm ci`, `npm run lint`, `npm test`,
  `npm run build` com as variáveis locais carregadas somente no processo,
  `git diff --check` e inspeção do estado/migration list do Supabase.
- Evidência observada: lint passou, 17 arquivos e 98 testes passaram, o build
  compilou TypeScript e gerou 46 rotas; a migration nova foi identificada como
  pendente localmente.
- Validações não executadas e motivo: o `supabase db push --dry-run` e o
  `migration list --linked` foram bloqueados porque a base remota já contém as
  migrations `20260806144434`, `20260806151846` e `20260806153847`, ausentes
  nesta branch; o `db lint --linked` excedeu o tempo de conexão. O pgTAP
  novo e a homologação visual continuam pendentes.

## Impacto operacional

- Deploy necessário: sim, para expor a fila e as ações no Chat com Pedro.
- Migração aplicada: não; deve ser aplicada antes da homologação real.
- Compatibilidade/rollback: a remoção da migration e do código deixa o Inbox
  como único local de revisão; nenhum envio externo é criado pela sincronização
  sem decisão humana.

## Pendências e riscos

- Executar validações automatizadas e revisar o SQL com o Supabase CLI.
- Homologar o mesmo caso no Inbox e no Chat, incluindo conflito de versão,
  ensinar e gerar outra, descarte e múltiplas sugestões do mesmo lead.
- Publicar somente após aprovação da homologação visual e operacional.

## Documentos relacionados

- Decisão: `docs/decisions/chat-pedro-assisted-queue.md`.
- Guia de homologação: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
