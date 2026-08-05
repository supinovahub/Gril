# Nomes de contatos do WhatsApp no Inbox

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `agent/inbox-contact-name`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir conversas criadas a partir de mensagens enviadas manualmente pelo celular conectado do Pedro real que apareciam no Inbox somente como `Contato do WhatsApp`, apesar de o payload do provedor trazer o nome do chat/cliente.

## Antes e depois

- Antes: o normalizador Uazapi procurava o nome apenas em alguns caminhos do payload; a trigger criava ou reutilizava o contato sem promover um placeholder quando o nome chegava depois. O Inbox lia corretamente `contacts.name`, mas esse campo permanecia genérico.
- Depois: o normalizador aceita nomes em caminhos de chat usados pelo Uazapi, o nome normalizado acompanha o marcador interno da mensagem manual e uma trigger promove somente placeholders (`Contato do WhatsApp`/`Contato sem nome`). Um nome cadastrado manualmente nunca é sobrescrito. A migration também tenta recuperar placeholders históricos usando o metadata já persistido.

## Escopo executado

- Arquivos: `src/lib/integrations/whatsapp-runtime.ts`, `src/app/api/webhooks/whatsapp/[connectionId]/route.ts`, `src/lib/integrations/runtime-integrations.test.ts`, `supabase/tests/phase_26_whatsapp_contact_names.sql`, este registro e o roteiro de homologação.
- Migrations: criada `supabase/migrations/20260805121604_sync_whatsapp_contact_names.sql`; não aplicada ao Supabase remoto nesta tarefa.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: somente `git fetch`, consulta de migrations, lint do schema remoto e consulta agregada sem dados pessoais. Não houve deploy nem alteração persistente remota.

## Validação

- Comandos/testes executados: `git fetch origin`; `npx supabase migration list --linked`; teste direcionado Uazapi (18/18); `npm test` (19 arquivos, 108 testes); `npm run lint`; `npm run build`; `npx supabase db lint --linked --fail-on error`; `git diff --check`.
- Evidência observada: o estado remoto tinha 45 mensagens externas do celular, 41 com algum nome retido no metadata e 19 contatos com placeholder. A consulta não retornou nomes, telefones ou conteúdo de conversa.
- Validações não executadas e motivo: `npx supabase test db supabase/tests/phase_26_whatsapp_contact_names.sql` não foi executado porque a migration ainda não foi aplicada remotamente e não há Docker/Podman disponível para subir o banco local. O typecheck isolado (`npx tsc --noEmit`) continua falhando em dois erros preexistentes de `src/lib/ai/pedro-turn.test.ts:131`, não relacionados a esta mudança. A validação visual/manual do Inbox permanece pendente pelo protocolo do projeto.

## Impacto operacional

- Deploy necessário: não executado; deve ocorrer após revisão/aplicação controlada da migration.
- Migração aplicada: não.
- Compatibilidade/rollback: contatos com nomes confirmados são preservados; a migration é aditiva e pode ser revertida removendo a trigger/função e restaurando os placeholders apenas com backup/decisão explícita. O backfill não apaga nomes.

## Pendências e riscos

- Aplicar a migration no banco remoto único somente após autorização operacional e revisar o resultado agregado de placeholders recuperados.
- Homologar manualmente uma mensagem enviada pelo celular conectado, incluindo placeholder histórico e contato com nome cadastrado manualmente.
- Confirmar no próximo deploy que a versão do webhook Uazapi usada pela instância real entrega pelo menos um dos caminhos de nome cobertos pelo normalizador.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção implementa a regra já documentada de exibir nome/telefone e não introduz regra de produto nova.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção Uazapi.
