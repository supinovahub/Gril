# Loop governado de melhoria contínua do Pedro

- Data: 17/08/2026
- Responsável: Codex
- Branch/PR: `agent/continuous-improvement-loop` / PR draft #49
- Commit: o commit que contém este arquivo

## Objetivo

Eliminar o ajuste manual infinito do agente ao implementar feedback estruturado com revisão humana, skills modulares e um meta-revisor semelhante ao Hermes, sem permitir autoalteração ou publicação silenciosa.

## Antes e depois

- Antes: correções, descartes e falhas ficavam distribuídos entre conversas, candidatos de aprendizado e logs; a aprovação gerava um rascunho monolítico e uma regressão sem materializar os jobs do novo pacote.
- Depois: sinais duráveis são agrupados por organização, Lionel abre propostas para decisão, mudanças de comportamento viram skills versionadas e a aprovação materializa todos os casos/jobs da regressão. Só o dono publica depois de 100% de aprovação e zero falha crítica.

## Escopo executado

- Arquivos: rota `/app/aprendizados`, link contextual no console do Pedro, actions server-side, worker, meta-revisor OpenAI, tipos do banco, testes Vitest e pgTAP, decisão e guia operacional.
- Migrations: `20260817200000_continuous_improvement_loop.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: branch publicada e PR draft #49 aberto; depois, a branch foi integrada ao PR draft #50. A migration foi aplicada ao Supabase canônico após preservar o valor legado `assisted_suggestion`; produção não recebeu deploy.
- Base visual preservada: `agent/workspace-redesign-real`, incluindo os contratos posteriores de desempenho de `fix/workspace-loading-bottlenecks`.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npx tsc --noEmit --pretty false`; `npm run build -- --webpack`; parser PostgreSQL e PL/pgSQL do `libpg-query`; `npx supabase db push --linked --dry-run`; `npx supabase migration list --linked`; `npx supabase db lint --linked --fail-on error`; inspeção local com `agent-browser`.
- Evidência observada: lint aprovado; 23 arquivos/112 testes aprovados; build Next.js 16.2.12 aprovado com 46 rotas; migration aplicada e contratos de RLS, grants e funções confirmados no remoto; CI/preview da branch original passaram e o preview combinado final ficou `Ready` em `gru1`. A página Aprendizados passou a usar `learnings_workspace_bootstrap` e respondeu em 0,292–0,539 s nas cinco medições autenticadas.
- Validações não executadas e motivo: o runner pgTAP `supabase test db --linked` tentou iniciar Docker, ausente neste host. As asserções de segurança e schema foram executadas diretamente no Supabase remoto. A homologação visual autenticada e os fluxos de decisão/publicação permanecem humanos.

## Impacto operacional

- Deploy necessário: sim, após revisão o bundle deve seguir as migrations já aplicadas. O preview combinado está `Ready` e protegido; produção não foi alterada.
- Migração aplicada: sim, `20260817200000_continuous_improvement_loop.sql`, seguida do bootstrap de desempenho `20260817201000_optimize_continuous_improvement_routes.sql`.
- Compatibilidade/rollback: rollback deve restaurar o bundle anterior e arquivar/desativar o consumo dos novos contratos; evidências e auditoria não devem ser apagadas.

## Pendências e riscos

- Homologar com dono/gestor e modelo OpenAI ativo; confirmar que achados técnicos não viram skill e que falha de regressão bloqueia publicação.
- A página ainda depende de sessão e dados reais para a validação visual autenticada final; a inspeção local comprovou apenas o gate de autenticação e a tela de login.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-17-melhoria-continua-governada.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
