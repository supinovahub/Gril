# Correção dos gargalos de carregamento do workspace

- Data: 17/08/2026
- Responsável: Codex
- Branch/PR: `fix/workspace-loading-bottlenecks`; PR #48 contra `agent/workspace-redesign-real`
- Commit: o commit que contém este arquivo

## Objetivo

Eliminar os gargalos de carregamento observados no redesign do workspace sem alterar as regras de produto, reduzindo consultas repetidas, payloads excessivos, bloqueio do shell e refreshes concorrentes.

## Antes e depois

- Antes: o layout aguardava sessão e badges antes de renderizar; a sessão comum fazia até sete consultas; Inbox, Leads e Kanban usavam relações aninhadas; o Dashboard executava consultas por etapa; a Central transferia até centenas de registros de sete fontes para filtrar e paginar em JavaScript; eventos Realtime podiam disparar refresh completo em rajadas.
- Depois: o shell depende somente do contexto do usuário em um RPC; badges são carregados em `Suspense`; listagens e resumos usam projeções SQL planas; métricas, Dashboard e Central são agregados no banco; rotas críticas têm `loading.tsx`; o cliente Realtime é carregado sob demanda e agrupa eventos com debounce, transição e pausa em aba oculta.

## Escopo executado

- Arquivos: `src/app/app/{layout,page,inbox,leads,kanban,central}`, `src/components/app-shell`, `src/lib/{auth,inbox,internal-chat,observability,database.types.ts}`, testes e documentação operacional.
- Migrations: `20260817150703_optimize_workspace_loading.sql`, com cinco views `security_invoker`, quatro funções `security invoker` e nove índices direcionados aos filtros e ordenações medidos.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: a migration foi aplicada no projeto Supabase remoto `frslhzwhaooqtivkzdez`. O registro criado pelo conector como `20260817152309` foi corrigido somente na history para a versão local canônica `20260817150703`; o SQL não foi reaplicado. Nenhum deploy Vercel foi feito até este registro.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build -- --webpack`; `npx tsc --noEmit --pretty false`; `npx supabase db lint --linked --fail-on error`; `npx supabase migration list --linked`; `git diff --check`; smoke remoto pela Data API; advisors de segurança e performance do Supabase.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build das 46 rotas aprovado; migration local/remota alinhada em `20260817150703`; Data API retornou 83 registros reais de Inbox, Leads e Kanban em 81–93 ms, e os contratos de Dashboard, Central e badges responderam em 97–242 ms. Os advisors não apontaram alerta de segurança relacionado aos novos objetos.
- Validações não executadas e motivo: o arquivo pgTAP foi adicionado, mas não executado localmente porque Docker não está disponível; as mesmas propriedades estruturais foram consultadas no banco remoto. A inspeção visual autenticada depende da publicação da preview. O `tsc` global preserva três erros preexistentes em `src/lib/ai/pedro-turn.test.ts` e `src/lib/integrations/openai-runtime.test.ts`; o build do Next e a suíte Vitest passam.

## Impacto operacional

- Deploy necessário: sim, para ativar as otimizações de aplicação; a migration já é compatível com o código anterior e está ativa no banco único.
- Migração aplicada: sim, `20260817150703_optimize_workspace_loading.sql`, com history local/remota alinhada.
- Compatibilidade/rollback: o contrato existente de `inbox_notification_counts` foi preservado. O código contém fallback para as consultas anteriores nos RPCs de sessão, Dashboard e badges. Qualquer reversão de DDL deve ser feita por nova migration forward-only; não apagar o registro remoto nem editar migration já aplicada.

## Pendências e riscos

- Publicar a branch e validar a preview autenticada nas rotas `/app`, `/app/inbox`, `/app/leads`, `/app/kanban` e `/app/central`.
- Os índices recém-criados aparecem como não utilizados no advisor até acumularem tráfego suficiente; revisar `pg_stat_user_indexes` após a homologação, sem removê-los nesta rodada.
- Não há staging Supabase: a migration já está no banco compartilhado, embora o bundle de aplicação ainda aguarde deploy.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a mudança é técnica e preserva as regras existentes.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção de desempenho e atualização do workspace.
