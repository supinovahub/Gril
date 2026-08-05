# Publicação da correção do UUID na edição de nome

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/inbox-contact-name-uuid` / PR #28
- Commit: o commit que contém este arquivo

## Objetivo

Registrar a publicação da correção que eliminou o erro `invalid uuid` ao editar nomes no Inbox.

## Antes e depois

- Antes: a PR #28 corrigia o carregamento do `contacts.id`, mas ainda não estava mesclada nem publicada.
- Depois: a PR #28 foi mesclada na `phase/01-foundation` com o merge commit `681dda07`; o deployment de produção associado está `READY`.

## Escopo executado

- Arquivos: atualização de `docs/agent/CURRENT_STATE.md` e este registro.
- Migrations: nenhuma nova; a migration `20260805124457_edit_contact_name.sql` continua aplicada e alinhada local/remota.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: PR #28 mesclada; Vercel publicou `gril-rmlqyfs21-brio5.vercel.app` em produção.

## Validação

- Comandos/testes executados: `gh pr view 28`; `npm run lint`; `npm test`; `npm run build`; `npx --yes vercel@latest -Q "C:\Users\arthu\.vercel-profiles\supinovahub-7501" whoami`; listagem Vercel; `curl.exe -I -L https://gril-lac.vercel.app`.
- Evidência observada: PR `MERGED`; CI verde; deployment `READY` associado ao commit `681dda07`; Vercel autenticado como `suporteinovahub-7501`; URL canônica respondeu `200` em `/login`.
- Validações não executadas e motivo: homologação visual com uma conta real ainda depende do teste humano no Inbox.

## Impacto operacional

- Deploy necessário: concluído automaticamente pelo merge.
- Migração aplicada: nenhuma nova; estado remoto permanece alinhado.
- Compatibilidade/rollback: alteração restrita à seleção do UUID existente; rollback é reversão do arquivo sem impacto no schema.

## Pendências e riscos

- Confirmar manualmente no Inbox que um dono/gestor consegue salvar o nome sem `invalid uuid`.
- Confirmar que o detalhe do lead permanece funcional.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: o cenário existente de edição de nome continua aplicável.
