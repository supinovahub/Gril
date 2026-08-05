# Edição manual do nome dos contatos

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `feat/inbox-edit-contact-name`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que dono ou gestor corrija manualmente o nome de um contato pelo dashboard quando o nome automático do WhatsApp estiver ausente ou incorreto.

## Antes e depois

- Antes: o Inbox e o detalhe do lead exibiam o nome salvo, mas não havia uma ação de edição manual.
- Depois: dono/gestor pode abrir o lápis ao lado do nome no detalhe da conversa ou do lead, salvar a correção e atualizar o contato com histórico de auditoria. Corretores não recebem a ação na interface.

## Escopo executado

- Arquivos: páginas e estilos do Inbox/lead, ação server-side compartilhada, helper de permissão, tipos gerados, teste pgTAP, guia de homologação e este registro.
- Migrations: criada `supabase/migrations/20260805124457_edit_contact_name.sql` com tabela de comandos, RLS, trigger de validação e auditoria.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma; a migration foi apenas validada com `db push --dry-run` e permanece pendente no remoto.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test` (19 arquivos, 108 testes); `npm run build`; teste isolado de integridade UTF-8; `npx supabase db push --linked --dry-run`; `git diff --check`.
- Evidência observada: lint, testes e build passaram; o dry-run identificou somente `20260805124457_edit_contact_name.sql` como migration pendente.
- Validações não executadas e motivo: teste pgTAP não foi executado porque a migration não foi aplicada e não há Docker/Podman disponível para banco local; homologação visual e de permissão depende de deploy e conta autorizada.

## Impacto operacional

- Deploy necessário: sim, após revisão/merge da branch.
- Migração aplicada: não.
- Compatibilidade/rollback: a alteração é aditiva; a edição só pode ocorrer para contato não fundido e por comando auditado. Remover a funcionalidade exige retirar a ação/UI e a migration em procedimento separado.

## Pendências e riscos

- Aplicar a migration no Supabase remoto antes de usar o formulário em produção.
- Homologar com dono/gestor: editar nome no Inbox e no lead, recarregar e confirmar persistência.
- Homologar com corretor: confirmar ausência do botão e rejeição server-side se a requisição for forjada.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/phase-02.md`, com a regra de correção manual auditável do nome.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção Uazapi.
