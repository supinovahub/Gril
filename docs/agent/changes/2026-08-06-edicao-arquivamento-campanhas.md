# Edição e arquivamento de campanhas de reativação

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feature/campaign-edit-archive`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que dono ou gestor edite a configuração de uma campanha de reativação em estados seguros e arquive campanhas sem deixar disparos pendentes ativos.

## Antes e depois

- Antes: a tela listava campanhas, importava bases e controlava ondas, mas não oferecia edição nem uma visualização própria para campanhas arquivadas.
- Depois: a tela separa campanhas ativas e arquivadas, permite editar campanhas sem ondas liberadas e oferece arquivamento auditado com cancelamento de jobs e exclusão dos contatos ainda não enviados.

## Escopo executado

- Arquivos: `src/app/app/campanhas/actions.ts`, `src/app/app/campanhas/page.tsx`, `src/app/app/campanhas/campaigns.module.css`, `src/lib/database.types.ts`, este registro, decisão de produto e guia de homologação.
- Migrations: `20260806165000_chat_pedro_assisted_queue.sql` foi incluída para alinhar o histórico local ao remoto; `20260806170711_campaign_edit_archive.sql` cria o comando de edição, o status `archived` e a transição de arquivamento.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: a migration `20260806170711_campaign_edit_archive.sql` foi aplicada ao projeto Supabase canônico; o branch foi publicado no GitHub; e o deployment `dpl_6fHG59SPq3QmNBFbxsThK8LLeKhz` foi promovido para `https://gril-lac.vercel.app`. Nenhum dado de lead foi alterado por esta implementação.

## Validação

- Comandos/testes executados: `npm test`, `npm run lint`, `npm run build`, `npx supabase db lint --linked --fail-on error`, `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`, `npx supabase db query --linked --file supabase/tests/phase_35_campaign_edit_archive.sql`, `vercel inspect` e requisição HTTP para `/login`.
- Evidência observada: 18 arquivos e 99 testes Vitest passaram; lint passou; build gerou 46 rotas; o dry-run mostrou somente a migration da campanha; o pgTAP confirmou 9 cenários; o schema remoto contém `campaign_edit_requests`, `archived_at` e `archived_by`; Vercel ficou `Ready` e `/login` respondeu HTTP 200.
- Validações não executadas e motivo: homologação visual do fluxo autenticado ainda depende de uma campanha de teste.

## Impacto operacional

- Deploy necessário: concluído; a tela está disponível no ambiente de produção.
- Migração aplicada: sim, `20260806170711_campaign_edit_archive.sql`.
- Compatibilidade/rollback: campanhas existentes continuam ativas; arquivamento é terminal e não reinicia jobs. O rollback exige migration específica de reversão e não deve remover auditoria.

## Pendências e riscos

- Homologar visualmente com uma campanha de teste e confirmar o comportamento com Meta e Uazapi.
- Confirmar a aplicação da migration sem incluir migrations concorrentes não pertencentes a esta tarefa.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/campaign-edit-archive.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
