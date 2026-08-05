# Correção do UUID na edição de nome do contato

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/inbox-contact-name-uuid` (PR a ser aberta)
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir o erro `invalid uuid` ao salvar o nome de um contato pelo detalhe de uma conversa no Inbox.

## Antes e depois

- Antes: o detalhe do Inbox carregava o nome e os telefones do contato, mas omitia `contacts.id` na consulta. O formulário enviava `contactId` vazio e a action rejeitava o valor como UUID inválido.
- Depois: a consulta do Inbox carrega também `contacts.id`; o formulário envia o UUID canônico do contato e a migration existente processa a alteração auditável.

## Escopo executado

- Arquivos: `src/app/app/inbox/[id]/page.tsx` e este registro.
- Migrations: nenhuma; `20260805124457_edit_contact_name.sql` já está aplicada e não precisava de alteração.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta correção local.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build`; `git diff --check`.
- Evidência observada: lint passou; 19 arquivos e 108 testes passaram; build Next.js concluiu com 46 rotas; diff sem erros de whitespace.
- Validações não executadas e motivo: homologação visual com uma conta real depende da publicação da correção; não foi feita alteração no banco.

## Impacto operacional

- Deploy necessário: sim, para disponibilizar a correção no Inbox.
- Migração aplicada: não há nova migration.
- Compatibilidade/rollback: alteração restrita à seleção do ID já existente; rollback é reversão do arquivo sem impacto no schema.

## Pendências e riscos

- Publicar a branch e confirmar no Inbox que o nome salva sem `invalid uuid`.
- Repetir a validação no detalhe do lead, que já enviava `contacts.id` corretamente.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a regra de edição manual permanece a mesma.
- Guia de homologação atualizado: o cenário existente de edição de nome continua aplicável.
