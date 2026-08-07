# Integração de mensagens dinâmicas com campanhas arquivadas

- Data: 07/08/2026
- Responsável: Codex
- Branch/PR: `fix/campaign-dynamic-messages-archive`
- Commit: o commit que contém este arquivo

## Objetivo

Reintegrar a lógica de mensagens dinâmicas por lead à implementação que separa
campanhas ativas e arquivadas, evitando que um deploy de uma frente remova a
outra.

## Antes e depois

- Antes: a tela e a action usavam uma única abertura, descartavam as colunas
  extras do CSV e a versão publicada não passava `opening_variants` para o
  banco.
- Depois: a criação aceita três variações, a importação preserva os campos da
  planilha, o preview/envio usam o mesmo renderer e a listagem continua
  separando ativas de arquivadas.

## Escopo executado

- Arquivos: actions/página de campanhas, parser CSV, renderer e testes das
  variações, tipos gerados, migration dinâmica e guia de homologação.
- Migrations: `20260806202829_campaign_dynamic_messages.sql` foi recuperada
  para o histórico local na versão final com rotação por onda; ela já constava
  como aplicada no Supabase remoto e não foi reaplicada nesta tarefa.
- Mudanças externas: deploy de produção será registrado após a confirmação do
  deployment final.

## Validação

- Comandos/testes: testes específicos, ESLint dos arquivos alterados, `npm
  test`, `npm run build`, `npx supabase migration list --linked`.
- Evidência antes do deploy: 76 arquivos e 413 testes aprovados; build Next.js
  16.2.12 com 46 rotas; migration dinâmica local/remota alinhada.
- `npx tsc --noEmit` ainda acusa dois erros preexistentes em
  `src/lib/ai/pedro-turn.test.ts`, fora do escopo.
- `npx supabase db lint --linked` não concluiu por falha de autenticação do
  usuário temporário da CLI; não foi feita alteração remota como alternativa.

## Impacto operacional

- Deploy necessário: sim, após a validação final do pacote.
- Migração aplicada: não nesta tarefa; a versão correspondente já estava
  aplicada remotamente.
- Compatibilidade/rollback: campanhas sem pack continuam usando
  `opening_template`; rollback do bundle não deve remover a migration já
  aplicada.

## Pendências e riscos

- Homologação manual com uma base sintética e uma onda controlada permanece
  necessária.
- O histórico remoto ainda possui a migration `20260807130110` sem arquivo
  correspondente na working tree; isso é divergência preexistente e não foi
  alterado nesta correção.

## Documentos relacionados

- Decisão: `docs/decisions/campaign-dynamic-messages.md`.
- Guia: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
