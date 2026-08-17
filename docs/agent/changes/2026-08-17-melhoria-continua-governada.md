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
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: consultas somente leitura ao Supabase e GitHub; nenhuma migration aplicada, nenhum dado alterado e nenhum deploy executado.
- Base visual preservada: `agent/workspace-redesign-real`, incluindo os contratos posteriores de desempenho de `fix/workspace-loading-bottlenecks`.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test`; `npx tsc --noEmit --pretty false`; `npm run build -- --webpack`; parser PostgreSQL e PL/pgSQL do `libpg-query`; `npx supabase db push --linked --dry-run`; `npx supabase migration list --linked`; `npx supabase db lint --linked --fail-on error`; inspeção local com `agent-browser`.
- Evidência observada: lint aprovado; 23 arquivos/112 testes aprovados; build Webpack aprovado com 46 rotas usando as variáveis locais existentes sem copiá-las para a worktree; SQL e corpos PL/pgSQL analisados sem erro sintático; dry-run alinhado mostrou somente a migration `20260817200000`; db lint remoto sem erros e com avisos preexistentes; rota protegida redirecionou para o login renderizado sem tela em branco; nenhuma migration foi enviada.
- Validações não executadas e motivo: a execução local da migration/pgTAP não iniciou porque Docker e Podman não estão instalados. O `tsc` global mantém três erros preexistentes em `pedro-turn.test.ts` e `openai-runtime.test.ts`, sem erro novo desta mudança.

## Impacto operacional

- Deploy necessário: sim, após revisão, migration e bundle devem seguir juntos.
- Migração aplicada: não.
- Compatibilidade/rollback: até a aplicação da migration, o bundle atual continua inalterado. Após publicação, rollback deve restaurar o bundle anterior e arquivar/desativar o consumo dos novos contratos; evidências e auditoria não devem ser apagadas.

## Pendências e riscos

- Executar migration e pgTAP em ambiente PostgreSQL compatível antes de aplicar no remoto único.
- Homologar com dono/gestor e modelo OpenAI ativo; confirmar que achados técnicos não viram skill e que falha de regressão bloqueia publicação.
- A página ainda depende de sessão e dados reais para a validação visual autenticada final; a inspeção local comprovou apenas o gate de autenticação e a tela de login.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/2026-08-17-melhoria-continua-governada.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
