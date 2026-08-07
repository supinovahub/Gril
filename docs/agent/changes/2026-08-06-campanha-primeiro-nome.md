# Primeiro nome na campanha de reativação

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: o commit que contém este arquivo

## Objetivo

Fazer a abertura da campanha de reativação usar sempre somente o primeiro nome,
mesmo quando o telefone encontra um contato existente com nome completo no CRM.

## Antes e depois

- Antes: o preview usava `contacts.name`; o worker separava o primeiro termo do
  CRM, mas não havia um snapshot compartilhado entre preview e disparo.
- Depois: `campaign_contacts.campaign_first_name` congela o primeiro nome da
  linha importada, com fallback ao primeiro termo do contato. Preview e worker
  usam o mesmo snapshot, sem alterar o nome completo do CRM.

## Escopo executado

- Arquivos: migration de campaign contact, tipos do banco, teste SQL, decisão,
  guia de homologação e este registro.
- Migrations: `20260806171000_campaign_first_name.sql`.
- Mudanças externas: a migration foi aplicada no Supabase remoto em
  06/08/2026. A aplicação Vercel já estava em `Ready` e não houve novo deploy
  porque a correção altera somente funções e dados do banco.

## Validação

- Comandos/testes executados: `git fetch origin`, `git status --short --branch`,
  `npx supabase migration list --linked`, `npx eslint src`, `npm test`,
  `npm run build`, `npx supabase db lint --linked --fail-on error`,
  `git diff --check` e simulação transacional da migration no Supabase remoto.
- Evidência observada: 36 arquivos e 198 testes passaram; o build compilou e
  gerou 46 rotas; o lint do banco terminou sem erros; a simulação foi revertida
  e mostrou a campanha `Campanha real` com `Olá Marcelo`, `Olá Monica`,
  `Olá Maria` e os demais primeiros nomes, sem nomes completos. Após a
  publicação, o banco confirmou a migration aplicada, a coluna e o trigger de
  snapshot, o renderizador e o executor de runtime usando o snapshot.
- Validações não executadas e motivo: `npm run lint` sem escopo falhou ao
  percorrer artefatos `.next` de um worktree não relacionado em
  `.worktrees/campaign-edit-archive`; o lint equivalente restrito a `src`
  passou. O teste pgTAP completo não foi executado porque Docker/Postgres local
  não está disponível.

## Impacto operacional

- Deploy Vercel necessário: não, pois não houve alteração no bundle da
  aplicação; a publicação efetiva foi a migration no banco único remoto.
- Migração aplicada: sim, `20260806171000_campaign_first_name`.
- Compatibilidade/rollback: o nome canônico do CRM permanece intacto; qualquer
  rollback do comportamento precisa ser uma mudança explícita de banco e não
  deve apagar o nome completo do CRM.

## Pendências e riscos

- Confirmar que o preview e a mensagem efetivamente enfileirada usam o mesmo
  primeiro nome.
- O histórico local ainda contém a migration não rastreada
  `20260806165420_campaign_edit_archive.sql`, enquanto o remoto registra a
  mesma frente como `20260806170711`. Para publicar com segurança foi usada
  uma cópia temporária alinhada, sem aplicar ou reparar a migration de outra
  frente. A working tree compartilhada continua com essa divergência para
  decisão do responsável pela frente de arquivamento.
- Validar com uma campanha HML- com contato novo e contato já existente.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/campaign-first-name.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
