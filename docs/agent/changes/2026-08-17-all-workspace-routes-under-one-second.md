# Carregamento de todas as telas do workspace em até um segundo

- Data: 2026-08-17
- Responsável: Codex
- Branch/PR: `perf/all-workspace-routes-under-one-second` / PR draft a criar
- Commit: o commit que contém este arquivo

## Objetivo

Estender para todas as telas autenticadas do workspace a meta de carregamento de até um segundo que já havia sido comprovada na troca entre Visão geral e Inbox.

## Antes e depois

- Antes: em organização populada, documentos autenticados completos levavam de aproximadamente 1,9 s a 4,3 s, com os maiores gargalos em Busca, Kanban, Central, Agenda, Chat Pedro, Leads e detalhes de lead.
- Depois: navegação global consulta contadores em um único bootstrap autorizado apó a montagem do shell e os mantém atualizados sem bloquear as trocas de tela; Agenda, Kanban e Leads carregam seus conjuntos de dados por RPCs dedicadas; detalhes de lead deixam de varrer contatos via RLS; links fazem prefetch completo apenas quando há intenção do usuário. A matriz final por rota será registrada apó o preview combinado.

## Escopo executado

- Arquivos: shell do workspace, links de navegação, páginas de Agenda/Kanban/Leads, tipos gerados e utilitários de contagem/prefetch.
- Migrations: `supabase/migrations/20260817195000_optimize_all_workspace_routes.sql`, `supabase/migrations/20260817195100_repair_workspace_feed_utf8.sql`, `supabase/migrations/20260817195200_optimize_remaining_workspace_routes.sql` e `supabase/migrations/20260817195300_minimize_workspace_route_payloads.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: migration de performance aplicada ao projeto Supabase canônico; dois deployments manuais de preview foram bloqueados antes do build e não alteraram produção; branch/PR e preview Git serão registrados na conclusão.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npm run build` com variáveis locais carregadas apenas no processo; medições HTTP autenticadas e medições diretas das RPCs com uma organização populada; `supabase migration list --linked`; `supabase db push --linked --dry-run`.
- Evidência observada: 22 arquivos e 110 testes passaram; build Next.js 16.2.12 concluído; as consultas antigas mais lentas (2,1–4,1 s) caíram para 0,126–0,821 s nas novas RPCs. No primeiro preview desta branch, 25 de 29 rotas ficaram abaixo de 1 s; Campanhas (1,170 s), Auditoria (1,097 s), Privacidade (1,604 s) e Relatórios (1,375 s) foram consolidados. A etapa seguinte reduziu os payloads de Campanhas de 42 KB para 23 KB, Auditoria de 116 KB para 14 KB e Relatórios de 27 KB para 559 bytes; as três RPCs responderam em 0,15–0,39 s aquecidas e no máximo 0,80 s no primeiro ciclo direto. A matriz HTTP final ainda será repetida no preview combinado.
- Validações não executadas e motivo: lint do banco, advisors, cinco ciclos por rota e homologação humana permanecem pendentes até a integração da branch `agent/continuous-improvement-loop`.

## Impacto operacional

- Deploy necessário: preview para validação; produção não alterada.
- Migração aplicada: sim, as quatro migrations acima estão aplicadas no projeto `frslhzwhaooqtivkzdez`; a segunda repara rótulos UTF-8 da função Central sem mudar sua assinatura.
- Compatibilidade/rollback: as RPCs são aditivas, exceto pela substituição compatível da função `central_feed_page`; rollback de código exige manter as RPCs enquanto houver clientes novos em uso.

## Pendências e riscos

- Integrar e revisar a branch `agent/continuous-improvement-loop`.
- Repetir lint, testes, build, advisors e medições no artefato combinado.
- Homologação visual e funcional autenticada continua humana, conforme o protocolo do projeto.

## Documentos relacionados

- Decisões atualizadas: nenhuma; não houve nova regra de produto.
- Guia de homologação atualizado: será atualizado com a matriz final e o roteiro de desempenho.
