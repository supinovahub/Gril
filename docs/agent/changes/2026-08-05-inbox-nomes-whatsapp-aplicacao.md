# Aplicacao da sincronizacao de nomes do WhatsApp

- Data: 05/08/2026
- Responsavel: Codex na sessao principal do Gril
- Branch/PR: `agent/inbox-contact-name` / PR #25 mergeado em `phase/01-foundation`
- Commit: o commit que contem este arquivo

## Objetivo

Aplicar em producao a migration preparada para promover nomes fornecidos pelo WhatsApp e pela Uazapi para contatos que ainda estavam com nome generico no Inbox.

## Antes e depois

- Antes: a aplicacao estava no deployment de producao, mas a migration ainda nao existia no banco remoto; havia 19 placeholders em 28 contatos.
- Depois: a migration `20260805121604_sync_whatsapp_contact_names.sql` foi aplicada, o trigger esta ativo e restaram 4 placeholders sem nome disponivel no metadata historico.

## Escopo executado

- Arquivos: nenhum novo arquivo de codigo; registro operacional desta aplicacao.
- Migrations: aplicada `supabase/migrations/20260805121604_sync_whatsapp_contact_names.sql`.
- Mudancas externas em Supabase, Vercel, GitHub ou fornecedores: migration aplicada no projeto Supabase remoto `frslhzwhaooqtivkzdez`.

## Validacao

- Comandos/testes executados: `npx supabase migration list --linked`; `npx supabase db push --linked --yes`; consulta agregada no banco remoto para contagem e existencia de funcao/trigger.
- Evidencia observada: migration local e remota alinhadas em `20260805121604`; `sync_function = true`; `sync_trigger = true`; contatos placeholder reduziram de 19 para 4.
- Validacoes nao executadas e motivo: Docker nao esta instalado, portanto o cache local/catalogo e os testes pgTAP locais nao foram executados; os 4 casos restantes nao tinham nome recuperavel nos paths de metadata cobertos.

## Impacto operacional

- Deploy necessario: ja realizado pela Vercel no commit de merge `6646516`, status `Ready`.
- Migracao aplicada: sim, no Supabase remoto.
- Compatibilidade/rollback: a trigger so atualiza placeholders (`Contato do WhatsApp`/`Contato sem nome`) e preserva nomes humanos; remover trigger e funcao exige decisao explicita.

## Pendencias e riscos

- Homologar manualmente uma nova mensagem enviada pelo celular conectado e confirmar o nome no Inbox.
- Os 4 contatos historicos sem nome no metadata somente poderao ser corrigidos se o provedor fornecer seus nomes novamente ou se um operador informar os nomes.

## Documentos relacionados

- Decisoes atualizadas: nenhuma.
- Guia de homologacao atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
