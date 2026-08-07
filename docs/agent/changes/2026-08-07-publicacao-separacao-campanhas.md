# Publicação da separação de campanhas arquivadas

- Data: 07/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: não criado; publicação feita a partir do estado local validado

## Objetivo

Publicar em produção a correção que impede campanhas arquivadas de aparecerem
na aba de campanhas ativas.

## Antes e depois

- Antes: a correção estava apenas no working tree local.
- Depois: o projeto Vercel `gril` recebeu a correção em deployment de produção
  `dpl_5Cg5HadfzakZAT4WtRi82EVbhP8s`.

## Escopo executado

- Arquivos: estado validado de `src`, `public`, manifests e configuração de
  build; sem inclusão de `.env`, worktrees, documentação ou migrations no
  pacote de deployment.
- Migrations: nenhuma aplicada.
- Mudanças externas: deployment Vercel criado no projeto
  `prj_bXVpRE42u98nhbRdnD0YZI2Ll82t`, time `team_3dWU0YCzzm8MuMjfh5qGQEdr`.

## Validação

- Comandos/testes executados: deployment acompanhado até `READY`; consulta do
  projeto Vercel; `GET https://gril-lac.vercel.app/login`.
- Evidência observada: deployment `READY`, criador `suporteinovahub-7501`,
  último deployment do projeto apontando para `dpl_5Cg5HadfzakZAT4WtRi82EVbhP8s`
  e rota pública respondendo HTTP 200.
- Validações não executadas e motivo: homologação autenticada das abas ainda
  depende de sessão e dados de campanha controlados; a validação automatizada
  local anterior passou com 409 testes, `eslint src` e build de 46 rotas.

## Impacto operacional

- Deploy necessário: concluído em produção.
- Migração aplicada: não.
- Compatibilidade/rollback: rollback Vercel para o deployment anterior, se
  necessário; nenhum dado de banco foi alterado.

## Pendências e riscos

- Homologar manualmente as abas “Ativas” e “Arquivadas” com dados controlados.
- O deployment foi feito sem commit porque a árvore compartilhada contém
  alterações não commitadas de outra frente; o código e o registro devem ser
  commitados juntos quando a frente for consolidada.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; o roteiro existente continua aplicável.
