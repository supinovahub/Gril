# Carregamento de todas as telas do workspace em até um segundo

- Data: 2026-08-17
- Responsável: Codex
- Branch/PR: `perf/all-workspace-routes-under-one-second` / PR draft #50
- Commit: o commit que contém este arquivo

## Objetivo

Estender a todas as telas autenticadas do workspace a meta de carregamento de até um segundo já comprovada na troca entre Visão geral e Inbox, integrando ao mesmo tempo a branch `agent/continuous-improvement-loop` sem reintroduzir cascatas.

## Antes e depois

- Antes: em uma organização populada, os documentos autenticados completos levavam aproximadamente 1,9–4,3 s; Busca, Kanban, Central, Agenda, Chat Pedro, Leads e detalhes de lead eram os piores casos.
- Depois: o shell não aguarda badges; Agenda, Kanban, Leads, Campanhas, Auditoria, Privacidade, Relatórios e Aprendizados usam bootstraps compactos; o Chat interno reúne criação/leitura de tópico, mensagens e marcador de leitura em uma única chamada; links fazem prefetch completo quando o usuário demonstra intenção.
- Resultado: depois do primeiro aquecimento, todas as 29 telas autenticadas concluíram a resposta em até 0,913 s. As dez rotas inicialmente afetadas por cold start foram repetidas cinco vezes por rota e ficaram entre 0,272 s e 0,867 s no preview final.

## Escopo executado

- Arquivos: shell e badges do workspace, links de navegação, páginas e loaders das rotas medidas, tipos do banco, observabilidade e testes de contrato.
- Migrations de desempenho: `20260817195000_optimize_all_workspace_routes.sql`, `20260817195100_repair_workspace_feed_utf8.sql`, `20260817195200_optimize_remaining_workspace_routes.sql`, `20260817195300_minimize_workspace_route_payloads.sql`, `20260817201000_optimize_continuous_improvement_routes.sql` e `20260817202000_optimize_internal_chat_workspace.sql`.
- Integração solicitada: merge explícito de `origin/agent/continuous-improvement-loop` no commit de merge `7af28d0`; a migration `20260817200000_continuous_improvement_loop.sql` foi corrigida para preservar o valor canônico `assisted_suggestion` já existente e aplicada antes dos bootstraps dependentes.
- Mudanças externas: migrations aplicadas ao Supabase canônico `frslhzwhaooqtivkzdez`; PR draft #50 e previews protegidas criados pela integração Git/Vercel. Produção não recebeu deploy.

## Validação

- Aplicação: `npm run lint`, 23 arquivos/112 testes em `npm test` e `npm run build` do Next.js 16.2.12 com 46 rotas passaram após o merge e após a consolidação do Chat.
- Banco: `supabase migration list --linked` alinhado até `20260817202000`; `supabase db push --linked --dry-run` executado antes de cada aplicação; `supabase db lint --linked --level warning` sem erro, mantendo avisos históricos. Consultas remotas confirmaram RLS nas tabelas contínuas, `search_path`/JIT fixos, autorização `ai.manage` no bootstrap de Aprendizados e o bootstrap de Chat como `SECURITY INVOKER`, sem execução por `anon`.
- Advisor: os avisos de segurança dos RPCs `SECURITY DEFINER` são intencionais e cada função faz autorização explícita antes de ler dados. Os avisos de desempenho restantes são informativos e predominantemente históricos/índices ainda sem uso.
- Preview final: `dpl_EcpVXDE6YrrES2ZNVjsesb1bbaq8`, `Ready`, região `gru1`, URL `https://gril-6w4x08b7u-brio5.vercel.app`.
- Matriz completa: na passagem sequencial fria, 20 de 29 telas já ficaram abaixo de 1 s; as nove acima do teto e o endpoint de badges foram repetidos em blocos de cinco. Máximos: badges 0,684 s; Agenda 0,431 s; Aprendizados 0,539 s; Busca 0,486 s; Campanhas 0,747 s; Central 0,695 s; Auditoria 0,368 s; Checklists 0,375 s. Após remover a cascata do Chat, Assistente ficou em 0,372–0,512 s, Chat Pedro em 0,503–0,867 s e Lionel em 0,347–0,430 s.
- Limitações: o runner pgTAP `supabase test db --linked` tentou iniciar Docker, ausente neste host; os mesmos contratos foram confirmados diretamente no banco remoto. A homologação visual/funcional autenticada permanece humana pelo protocolo do projeto.

## Impacto operacional

- Deploy necessário: apenas preview nesta etapa; produção continua em `https://gril-lac.vercel.app` sem esta branch.
- Migration aplicada: sim, versões `20260817195000` a `20260817202000` listadas acima estão alinhadas no remoto.
- Compatibilidade/rollback: os contratos novos são aditivos, exceto substituições compatíveis já documentadas. Um rollback de código deve manter as RPCs enquanto houver bundle novo em uso; evidências, auditoria e dados da melhoria contínua não devem ser apagados.

## Pendências e riscos

- Homologar visualmente as 29 telas e os fluxos de escrita da melhoria contínua com dono/gestor, sem publicar em produção antes dessa aprovação.
- Cold start após longo período ocioso ainda pode superar um segundo; a meta comprovada é a troca de telas em sessão autenticada após o primeiro aquecimento, conforme o guia canônico.

## Documentos relacionados

- Decisões atualizadas: nenhuma decisão nova de desempenho; a integração preserva `docs/decisions/2026-08-17-melhoria-continua-governada.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
