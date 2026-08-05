# Entrega de material baseada em ação estruturada

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/project-book-delivery`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a estratégia anterior de entrega de material, que tentava inferir o book a partir das palavras usadas no último inbound do lead.

## Antes e depois

- Antes: o worker chamava um detector textual do último lead. O primeiro patch apenas adicionou o verbo `enviar`, mas continuava dependente da forma da frase.
- Depois: a intenção de entrega é derivada exclusivamente de `project_media_request.kind`, ação estruturada validada no turno da IA. Se Pedro disser que enviará o book, a IA deve persistir `kind: "book"` e o worker executa essa ação sem analisar o verbo usado pelo lead.

## Escopo executado

- Arquivos: `src/lib/runtime/worker.ts`, `src/lib/ai/pedro-turn.ts`, `src/lib/ai/pedro-turn.test.ts`, `src/lib/ai/pedro-instructions.ts`, `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e este registro.
- Migrations: nenhuma; não houve alteração no contrato de banco nem no RPC de enfileiramento.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta etapa.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build`; `npx supabase db lint --linked --fail-on error`; `npx supabase db query --linked "select 1 as ok;"`; `git diff --check`.
- Evidência observada: lint passou; 19 arquivos e 108 testes passaram; build Next.js passou com 46 rotas; db lint terminou sem erros, mantendo somente avisos preexistentes; a consulta remota respondeu `ok = 1`.
- Validações não executadas e motivo: homologação visual/operacional com WhatsApp real não foi executada; depende de deploy e telefone autorizado conforme o protocolo do projeto.

## Impacto operacional

- Deploy necessário: sim; o worker precisa ser publicado para alterar o comportamento real.
- Migração aplicada: não se aplica.
- Compatibilidade/rollback: mudança restrita ao contrato interno do turno e à seleção da intenção; rollback por reversão do commit, sem alteração de schema ou dados.

## Pendências e riscos

- Validar que uma resposta que promete o book sempre contém `project_media_request` estruturado.
- Publicar e homologar com telefone autorizado, confirmando o PDF correto no WhatsApp e no Inbox.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a mudança aplica o contrato existente de Structured Outputs e ações validadas no backend.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
