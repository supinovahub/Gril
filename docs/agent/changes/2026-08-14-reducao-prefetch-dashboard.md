# Redução do lag de navegação no dashboard

- Data: 14/08/2026
- Responsável: Codex
- Branch/PR: `agent/workspace-redesign-real` / PR `#47`
- Commit: o commit que contém este arquivo

## Objetivo

Remover o tráfego especulativo que competia com a navegação real do usuário nas telas autenticadas, sem alterar dados, regras de produto, atualização Realtime ou a hierarquia visual aprovada.

## Antes e depois

- Antes: links de filtros, abas e registros usavam o prefetch automático do Next.js. Ao entrarem no viewport, filtros da mesma página e até cem links de Inbox ou Leads podiam iniciar renderizações dinâmicas autenticadas antes de qualquer clique. Os logs da preview mostraram rajadas da mesma rota, como `/app`, `/app/central` e detalhes de leads e conversas, todas com cache `MISS`.
- Depois: links primários do shell continuam com prefetch automático, mas coleções de alta cardinalidade, detalhes e visões alternativas usam `prefetch={false}`. A rota dinâmica passa a ser solicitada quando o usuário realmente escolhe o destino, evitando trabalho invisível no servidor e no Supabase.

## Escopo executado

- Arquivos:
  - `src/app/app/page.tsx`
  - `src/app/app/busca/page.tsx`
  - `src/app/app/campanhas/page.tsx`
  - `src/app/app/central/page.tsx`
  - `src/app/app/hoje/page.tsx`
  - `src/app/app/inbox/page.tsx`
  - `src/app/app/inbox/[id]/page.tsx`
  - `src/app/app/inbox/conversation-views.tsx`
  - `src/app/app/kanban/page.tsx`
  - `src/app/app/leads/page.tsx`
  - `src/app/app/meu-pipeline/page.tsx`
  - `src/app/app/simulador/page.tsx`
  - `src/components/internal-chat/internal-chat-workspace.tsx`
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: somente leitura dos logs do deployment de preview `dpl_Da6F2j4fs6PGkj1QGLff8fJgsq5S`. Foram abertas sessões temporárias da conta de homologação durante uma tentativa de medir rotas protegidas; nenhum dado de negócio, schema, RLS ou configuração foi alterado.

## Validação

- Comandos/testes executados:
  - `npm run lint`
  - `npm test`
  - `npx next build --webpack`, com as variáveis locais carregadas apenas no processo
  - `git diff --check`
  - inspeção dos runtime logs da preview com Vercel CLI 59
- Evidência observada:
  - lint aprovado;
  - 22 arquivos e 110 testes aprovados;
  - TypeScript aprovado e 46 rotas geradas pelo build;
  - Inbox e Leads carregam até cem registros por página, enquanto a Central consulta sete fontes de até oitenta registros; os links dessas coleções não iniciam mais prefetch de detalhes;
  - o build padrão com Turbopack compilou o código, mas o worktree usa um link de `node_modules` fora da raiz e acionou o erro conhecido de symlink; o build Webpack concluiu integralmente.
- Validações não executadas e motivo:
  - comparação autenticada antes/depois no navegador não foi concluída porque o Chrome estava bloqueado por uma interface de extensão aberta, o navegador isolado não estava disponível e o executável `agent-browser` não estava instalado;
  - métricas agregadas de duração da Vercel não estavam disponíveis porque o time não possui Observability Plus;
  - a tentativa de medir a preview protegida por `vercel curl` foi encerrada após a CLI 59 repassar incorretamente a opção de perfil global ao `curl` interno.

## Impacto operacional

- Deploy necessário: apenas nova preview automática do PR `#47`; produção permanece inalterada.
- Migração aplicada: não.
- Compatibilidade/rollback: compatível com as rotas e permissões existentes. O rollback consiste em remover `prefetch={false}` dos links afetados.

## Pendências e riscos

- Homologar a nova preview autenticada e confirmar que os cliques continuam exibindo o estado de loading já existente enquanto a rota escolhida é renderizada.
- A otimização reduz prefetch especulativo; não cria cache de dados autenticados e não mascara consultas lentas individuais.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a arquitetura funcional permanece a de `docs/decisions/2026-08-14-workspace-operacional-unificado.md`.
- Guia de homologação atualizado: não; os fluxos humanos não mudaram.
