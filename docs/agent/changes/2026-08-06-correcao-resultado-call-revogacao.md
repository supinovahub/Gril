# Correção do registro de resultado da call

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-result-revocation`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir o registro do resultado de uma call encerrada. O dashboard mostrava a recusa genérica mesmo após o prazo da reunião porque o roteamento pós-call tentava gravar `conversation_access_grants.revoked_by`, coluna que ainda não existia no banco remoto.

## Antes e depois

- Antes: a solicitação de resultado podia abrir a janela de registro, mas a transação era abortada ao revogar a liberação operacional da conversa.
- Depois: `conversation_access_grants` mantém o usuário que revogou o acesso, com referência segura a `auth.users`; o fluxo de resultado conclui a transação.

## Escopo executado

- Arquivos: migration, teste pgTAP, tipos TypeScript e mensagens de erro da ação de agenda.
- Migrations: `20260806125009_add_call_grant_revoked_by.sql` adiciona `revoked_by uuid` com `ON DELETE SET NULL`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: migration aplicada ao projeto Supabase `frslhzwhaooqtivkzdez`. Nenhuma alteração foi publicada na Vercel ou no GitHub.

## Validação

- Comandos/testes executados: `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`, `npx supabase db lint --linked --fail-on error`, `npm run lint`, `npm test`, `npm run build`, `git diff --check` e duas simulações autenticadas com `ROLLBACK` para `no_result` e `start_negotiation`.
- Evidência observada: migrations locais/remotas alinhadas; banco remoto atualizado; lint sem erros, apenas avisos preexistentes; 17 arquivos e 97 testes aprovados; build Next concluído; ambas as solicitações transacionais passaram e a call original permaneceu `assigned`, versão 3, sem resultado e sem revogação persistida.
- Validações não executadas e motivo: teste pgTAP local não foi executado porque o Docker não está instalado; validação visual/manual no dashboard não foi executada nesta etapa.

## Impacto operacional

- Deploy necessário: sim, para publicar a melhoria de mensagens em `actions.ts`; a correção de schema já está ativa no Supabase.
- Migração aplicada: sim, remotamente; `db push --dry-run` confirmou que não há migrations pendentes.
- Compatibilidade/rollback: a coluna é anulável e preserva chamadas existentes; remoção exige migration explícita e não é recomendada enquanto o roteamento a utiliza.

## Pendências e riscos

- Publicar o código pela conta Vercel autorizada pelo protocolo. A verificação obrigatória da identidade falhou neste host por ausência/expiração do refresh token, portanto a publicação foi bloqueada.
- Repetir o registro no dashboard após o deploy e confirmar visualmente o resultado esperado.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção implementa o modelo de rastreabilidade já documentado.
- Guia de homologação atualizado: não aplicável; o fluxo de produto não mudou.
