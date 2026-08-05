# Publicação da edição manual do nome dos contatos

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `docs/record-contact-name-edit-deployment` (registro pós-merge da PR #26)
- Commit: o commit que contém este arquivo

## Objetivo

Registrar o merge, a aplicação remota da migration e o deployment da edição manual do nome dos contatos.

## Antes e depois

- Antes: a funcionalidade estava implementada na branch `feat/inbox-edit-contact-name`, mas a migration ainda estava pendente no Supabase e o registro de estado ainda não refletia a publicação.
- Depois: a PR #26 foi mesclada na `phase/01-foundation` e a migration `20260805124457_edit_contact_name.sql` foi aplicada no projeto remoto `frslhzwhaooqtivkzdez`. O deployment de produção está `Ready`.

## Escopo executado

- Arquivos: atualização de `docs/agent/CURRENT_STATE.md` e este registro.
- Migrations: `20260805124457_edit_contact_name.sql` aplicada e confirmada como alinhada local/remota.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: PR #26 mesclada em 05/08/2026 com merge commit `2a58f82`; migration aplicada no Supabase; Vercel publicou `gril-7gsl7tfd-brio5.vercel.app` em produção.

## Validação

- Comandos/testes executados: `gh pr view 26`; `npx supabase migration list --linked`; `npx supabase db push --linked --yes`; consulta agregada de tabela/função/trigger/privilégios; `npx supabase db lint --linked --fail-on error`; verificação Vercel com o perfil `suporteinovahub-7501`; `curl.exe -I -L https://gril-lac.vercel.app`.
- Evidência observada: PR `MERGED`; migration local e remota em `20260805124457`; tabela, função e trigger existem; `authenticated_insert=true` e `authenticated_update=false`; lint sem erros; deployment `READY` associado ao commit `2a58f82`; URL canônica respondeu `200` em `/login`.
- Validações não executadas e motivo: pgTAP local permanece não executado por ausência de Docker/Podman; homologação funcional com contas reais ainda depende de teste humano.

## Impacto operacional

- Deploy necessário: concluído automaticamente pelo merge; deployment de produção confirmado como `Ready`.
- Migração aplicada: sim, no Supabase remoto `frslhzwhaooqtivkzdez`.
- Compatibilidade/rollback: alteração aditiva; rollback deve ser tratado como migration/procedimento separado para preservar o histórico de auditoria.

## Pendências e riscos

- Homologar a edição no Inbox e no detalhe do lead com dono/gestor.
- Confirmar que corretor não vê a ação e recebe rejeição server-side em tentativa forjada.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/phase-02.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
