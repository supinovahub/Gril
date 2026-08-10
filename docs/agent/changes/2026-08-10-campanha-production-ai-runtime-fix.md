# Separação da IA de produção de campanhas

- Data: 2026-08-10
- Responsável: Codex
- Branch/PR: `agent/campaign-ai-production-fix`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a falha que impedia respostas automáticas de uma campanha de reativação em `production` e eliminar a dependência acidental do modo global de inbound.

## Antes e depois

- Antes: a conversa criada pelo disparo da campanha permanecia com `journey = inbound`. O sincronizador global podia trocar seu `ai_mode` de `production` para `assisted`; quando o modelo devolvia argumentos de ferramenta inválidos, a execução falhava sem nova tentativa estruturada.
- Depois: conversas de campanhas de reativação são marcadas como `journey = reactivation` antes do modo padrão de inbound, preservam o `campaign.ai_mode`, usam o gate próprio de `reactivation_ai_mode`/release/conexão e são revalidadas ao capturar a execução. A integração OpenAI faz uma única nova chamada para corrigir uma decisão estruturada inválida ou ausente; nenhuma decisão inválida é aplicada.

## Escopo executado

- Arquivos:
  - `src/lib/integrations/openai-runtime.ts`
  - `src/lib/integrations/openai-runtime.test.ts`
  - `supabase/migrations/20260810140144_campaign_production_ai_runtime_fix.sql`
- Migrations: criada a migration acima; não aplicada ao Supabase remoto nesta tarefa.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma; a publicação foi bloqueada antes de qualquer alteração remota.

## Validação

- Comandos/testes executados: `npm test` (21 arquivos, 108 testes aprovados), `npm run lint` (aprovado), `npm run build` com as variáveis públicas do `.env.local` (aprovado), `git diff --check` (aprovado).
- Evidência observada: a análise da execução de 07/08 identificou `mode = production`, `error_code = openai_tool_arguments_invalid` e a conversa com `ai_mode = assisted`; a correção cobre ambos os caminhos.
- Validações não executadas e motivo: `npx supabase db lint --linked --fail-on error` excedeu o timeout de 120 segundos ao conectar ao banco remoto; `npx supabase migration list --linked` confirmou o estado remoto, mas também mostrou drift histórico entre migrations locais e remotas. A homologação de ponta a ponta depende de deploy e de uma nova campanha controlada, que não foram executados nesta branch.

## Impacto operacional

- Deploy necessário: sim, publicar o código e aplicar a migration antes de subir a nova campanha.
- Migração aplicada: não.
- Compatibilidade/rollback: a migration usa `create or replace`, triggers nomeados e backfill limitado a conversas de reativação ativas/pausadas; rollback deve ser feito por migration compensatória após confirmar o estado remoto.

## Pendências e riscos

- Aplicar a migration serialmente no único projeto Supabase de produção.
- Publicar a aplicação e executar um smoke test com um único contato antes de liberar uma onda maior.
- Renovar a sessão do perfil Vercel `supinovahub-7501`; o token e o refresh token atuais retornaram falha de autenticação (`invalid_grant`).
- Se a segunda chamada também devolver uma decisão inválida, a execução continua falhando de forma segura e sem mensagem automática.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a mudança implementa as regras já registradas para separar inbound de reativação.
- Guia de homologação atualizado: não; o fluxo humano de homologação não mudou.
