# Navegação entre Visão geral e Inbox abaixo de um segundo

- Data: 17/08/2026
- Responsável: Codex
- Branch/PR: `fix/workspace-loading-bottlenecks`; PR #48 contra `agent/workspace-redesign-real`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a regressão observada na preview em que a troca entre `/app` e `/app/inbox` levava aproximadamente cinco segundos, estabelecendo até um segundo como limite de carregamento para o percurso autenticado com a base atual.

## Antes e depois

- Antes: os runtime logs da preview registraram `inbox.conversation_list` entre 3.708 e 5.140 ms, além de `auth.viewer_context` entre 307 e 1.326 ms. A Visão geral aguardava cinco consultas paralelas, com `dashboard.attention` entre 4.211 e 4.993 ms e outras seções acima de 2.500 ms. As views planas ainda faziam as políticas correlacionadas de conversa, contato, oportunidade, estágio, mensagens e sugestões serem reavaliadas para cada linha e associação.
- Depois: Inbox e Visão geral usam um bootstrap autenticado por rota e uma única viagem à Data API. A autorização continua vinculada a `auth.uid()`, organização, operação, papel, escopo, grant de conversa e suporte contratual, mas é materializada uma vez antes das agregações. Em cinco repetições aquecidas com o proprietário real, Inbox ficou entre 146 e 183 ms e Visão geral entre 128 e 169 ms; com corretor, ficaram entre 101 e 241 ms e 115 e 189 ms. Uma sessão sintética recém-criada, medida imediatamente após o OTP, levou 1.119 ms na primeira Inbox e 184–217 ms nas seguintes. A primeira preview estrutural confirmou as RPCs em 370–569 ms, mas o documento completo ainda levou 1,22–1,85 s porque as Functions executavam em `iad1` e o Supabase está em `sa-east-1`; `vercel.json` agora fixa as Functions em `gru1`, próximas ao banco e aos usuários da operação. O preview administrativo de limpeza, antes iniciado em toda abertura do dashboard mesmo recolhido, passou a carregar sob demanda no `toggle` da Área administrativa.

## Escopo executado

- Arquivos: `src/app/app/page.tsx`, `src/app/app/inbox/page.tsx`, `src/app/app/homologation-actions.ts`, `src/app/app/homologation-cleanup-panel.tsx`, `src/lib/auth/session.ts`, `src/lib/database.types.ts`, `src/lib/observability/server-performance.ts`, `vercel.json`, `supabase/tests/phase_40_workspace_navigation_latency.sql`, este registro, `docs/agent/CURRENT_STATE.md` e `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Migrations: `20260817183000_workspace_navigation_under_one_second.sql`, `20260817191000_workspace_route_bootstrap.sql`, `20260817193000_lock_workspace_internal_contracts.sql` e `20260817194500_disable_workspace_query_jit.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: as quatro migrations foram aplicadas de forma serializada no projeto Supabase remoto `frslhzwhaooqtivkzdez`. Foram abertas sessões temporárias sem persistência local para medir proprietário e corretor pela Data API e no preview; nenhum dado de negócio foi alterado. O PR #48 foi atualizado, o deployment `dpl_9W5YKCPCYriirvQfZNH9H3xc3dXE` confirmou o código estrutural e uma nova preview automática validará a execução regional; produção permanece inalterada.

## Validação

- Comandos/testes executados: inspeção de runtime logs da Vercel; smoke autenticado da Data API com proprietário e corretor; teste de isolamento entre organizações; `npm run lint`; `npm test`; `npm run build -- --webpack`; `npx tsc --noEmit --pretty false`; `npx supabase migration list --linked`; `npx supabase db push --linked --dry-run`; `npx supabase db lint --linked`; advisors de segurança e performance; `git diff --check`.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Next.js 16.2.12 aprovado com 46 rotas; nenhum novo erro TypeScript fora dos três erros preexistentes em dois testes; migrations local/remoto alinhadas; smoke retornou 83 conversas para o proprietário, o escopo próprio do corretor e zero linhas/`authorized=false` ao solicitar outra organização; as RPCs aquecidas ficaram abaixo de 250 ms na maioria das amostras e abaixo de um segundo em todas. No primeiro preview, logs reais registraram `dashboard.workspace` em 370–420 ms e `inbox.workspace` em 528–569 ms nas repetições aquecidas; a medição de documento completo expôs a latência regional restante. No segundo, o artefato confirmou todas as Functions em `gru1` e o Inbox completo caiu para 0,44–0,71 s; os logs identificaram o preview HML- recolhido como a espera restante do dashboard.
- Validações não executadas e motivo: `supabase test db --linked` não iniciou o pgTAP porque a CLI exige Docker mesmo contra o projeto linked e este host não possui Docker/Podman. O arquivo de teste foi criado e a segurança foi compensada nesta rodada por grants mínimos, `search_path` bloqueado, advisors, lint e smoke autenticado com dois papéis. A inspeção visual fica para homologação humana conforme o protocolo do projeto.

## Impacto operacional

- Deploy necessário: nova preview automática do PR #48 com Functions em `gru1`; nenhum deploy de produção foi autorizado.
- Migração aplicada: sim, as versões `20260817183000`, `20260817191000`, `20260817193000` e `20260817194500` constam no Supabase remoto.
- Compatibilidade/rollback: as views e RPCs anteriores foram preservadas. O código mantém fallback para o contexto de sessão v2 e para as consultas anteriores da Visão geral em caso de falha do bootstrap. O rollback do bundle consiste em reverter os consumidores; as novas funções podem permanecer sem afetar versões anteriores.

## Pendências e riscos

- Confirmar na preview regional, pelo tempo HTTP e pelos runtime logs do artefato Vercel, que as trocas repetidas entre Inbox e Visão geral concluem em até um segundo.
- Produção continua sem esta correção até autorização e merge/deploy posteriores.

## Documentos relacionados

- Decisões atualizadas: nenhuma; as regras de produto e o escopo por papel não mudaram.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção “Desempenho e atualização do workspace”.
