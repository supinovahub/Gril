# Botão de limpeza do contexto de homologação

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-lead-time-timezone`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que o dono ou gestor autorizado limpe o contexto de homologação pelo dashboard sem apagar dados permanentes da imobiliária e sem remover a trilha de auditoria.

## Antes e depois

- Antes: a limpeza exigia identificar dependências e executar uma sequência manual de SQL.
- Depois: o dashboard exibe um preview limitado a registros com prefixo `HML-`, exige `CONFIRMAR AÇÃO`, executa a limpeza transacionalmente e registra um recibo auditável.

## Escopo executado

- Arquivos: `src/app/app/page.tsx`, `src/app/app/dashboard.module.css`, `src/app/app/homologation-actions.ts`, `src/lib/database.types.ts`, este registro e o guia de homologação.
- Migrations: `20260806151846_add_homologation_context_cleanup.sql` e `20260806153847_add_homologation_context_catalog_anchors.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: migration aplicada ao projeto Supabase remoto `frslhzwhaooqtivkzdez`; nenhum fornecedor real foi acionado.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build`; `npx supabase migration list --linked`; `npx supabase db push --linked --dry-run`; `npx supabase db lint --linked --fail-on error`; preview autenticado como dono; smoke test autenticado com contato sintético em transação revertida.
- Evidência observada: lint, 18 arquivos/99 testes e build com 46 rotas passaram; o preview retornou zero contexto após as limpezas anteriores; o smoke test encontrou e removeu `HML-SQL-SMOKE` e confirmou zero restante antes do `ROLLBACK`.
- Validações não executadas e motivo: revisão visual no Chrome e teste com anexos reais continuam humanos; o lint remoto passou com avisos preexistentes. O lint local não rodou porque o Docker/Postgres local não está disponível na porta `54322`.

## Impacto operacional

- Deploy necessário: sim, para publicar o dashboard e a Server Action; confirmar identidade Vercel canônica antes do deploy.
- Migração aplicada: sim, as duas migrations foram aplicadas no Supabase remoto; funções públicas aceitam somente usuários autenticados e dono/gestor com `team.manage`.
- Compatibilidade/rollback: a ação só seleciona contatos `HML-`, bloqueia mais de 20 e referências cruzadas, exige confirmação literal e preserva auditoria/configuração. Rollback de código não restaura dados já limpos; por isso a seleção é deliberadamente restrita.

## Pendências e riscos

- Publicar o commit e confirmar o deployment `Ready` e a rota `/app`.
- Executar manualmente o botão com um lead HML- real autorizado, primeiro um contato e depois, se necessário, até 20.
- Confirmar visualmente a remoção de arquivos e registrar qualquer pendência de storage.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a seleção usa o protocolo HML- já vigente.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
