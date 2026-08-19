# Publicação da correção do relógio de atividade da Inbox

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: implementação em `fix/inbox-activity-timestamp`, PR #70; registro
  em `docs/record-inbox-activity-production`, PR #71
- Commit: o commit que contém este arquivo; implementação integrada por
  `7879f67bb9782ce1feeb36622eba8402fa218771`

## Objetivo

Registrar a correção em produção que faz a Inbox ordenar e exibir cada card
pelo horário da última mensagem real, sem tratar atualizações operacionais da
conversa como atividade do contato.

## Antes e depois

- Antes: uma atualização em lote de `conversations.updated_at` fez conversas
  com mensagens em dias diferentes receberem o mesmo horário no card e permitiu
  que uma conversa antiga aparecesse acima de outra recente.
- Depois: `inbox_conversation_page` retorna no campo compatível `updated_at` o
  `messages.created_at` da última mensagem, com início da conversa como fallback.
  O bootstrap, o frontend e o horário do card usam esse mesmo valor.

## Escopo executado

- Arquivos: migration do RPC, índice da última mensagem, teste pgTAP, decisão,
  guia de homologação, utilitário/teste unitário e registros operacionais.
- Migrations: `20260819132358_inbox_message_activity_order.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: PR #70
  mergeado; migration aplicada no Supabase `frslhzwhaooqtivkzdez`; deployment
  Vercel `dpl_E8CYQtVGzNaoUTqGXTZpZF2HrBJc` publicado em produção.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test` (24 arquivos e 117
  testes); `npm run build` (46 rotas); checks do PR; `npx supabase db push
  --linked --dry-run`; `npx supabase db lint --linked --level warning`;
  `npx supabase migration list --linked`; consultas à função viva; inspeção do
  deployment e dos logs; homologação autenticada em `/app/inbox`.
- Evidência observada: migration local/remota alinhada; função viva usando a
  última mensagem e excluindo o relógio de metadados; conversa recente do caso
  reportado na posição 1 com horário de 18/08 e conversa antiga na posição 61
  com horário de 05/08; deployment `READY`, no commit canônico e no alias
  público; nenhum erro de runtime encontrado no período pós-deploy.
- Validações não executadas e motivo: o pgTAP local não foi executado porque o
  host não possui Docker/Podman. O teste de contrato ficou versionado para um
  ambiente Supabase compatível.

## Impacto operacional

- Deploy necessário: concluído automaticamente pela integração Git/Vercel.
- Migração aplicada: sim, `20260819132358`, de forma serializada.
- Compatibilidade/rollback: o formato do payload, as permissões, RLS e o limite
  de 100 conversas permanecem iguais. A migration não reescreve conversas nem
  mensagens. Um rollback exige nova migration forward-only e novo deployment.

## Pendências e riscos

- Nenhuma pendência técnica desta correção. A ausência de Docker impede apenas
  a execução local do pgTAP; CI, função viva e tela autenticada foram validados.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-inbox-chronological-order.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
