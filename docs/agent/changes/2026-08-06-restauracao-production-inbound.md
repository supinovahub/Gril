# Restauração de production no atendimento inbound

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `fix/restore-inbound-production`
- Commit: o commit que contém este arquivo

## Objetivo

Restaurar o botão e o funcionamento de `production` no atendimento normal,
mantendo os portões de prontidão e as revalidações determinísticas antes de
qualquer envio automático.

## Antes e depois

- Antes: a interface e a Server Action aceitavam apenas `off`, `shadow` e
  `assisted`; o banco rejeitava `production` no campo `inbound_ai_mode`.
- Depois: o inbound oferece os quatro modos e pode ser colocado em
  `production` quando o gate de prontidão do banco aprovar a configuração.

## Escopo executado

- Arquivos: tela e Server Action de Pedro, teste pgTAP, decisão de produto,
  guia de homologação e este registro.
- Migrations: `20260806140816_restore_inbound_production.sql`, que remove a
  restrição específica do inbound, aceita `production` no campo contextual e
  sincroniza os campos de modo existentes.
- Mudanças externas: a migration `20260806140816_restore_inbound_production.sql`
  foi aplicada no projeto Supabase `frslhzwhaooqtivkzdez`. O commit foi
  publicado na Vercel; o primeiro deploy direto ficou `BLOCKED`, então o
  deployment `Ready` do mesmo commit (`gril-jbq6j27pq-brio5.vercel.app`) foi
  promovido para Production como `gril-ns0qtvkbr-brio5.vercel.app`.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build`,
  `git diff --check`, `npx supabase migration list --linked`,
  `npx supabase db push --linked --dry-run`,
  `npx supabase db push --linked --yes`, `npx supabase db query --linked`,
  `npx supabase db lint --linked --fail-on error` e uma simulação remota da
  migration em transação com `ROLLBACK`; na Vercel, identidade, promoção,
  inspeção do deployment, rota pública e logs de erro também foram verificados.
- Evidência observada: lint, 98 testes e build com 46 rotas passaram; o banco
  remoto está alinhado até `20260806140816`; a consulta remota confirmou que
  o novo check aceita `production`, o check global continua aceitando o modo e
  a trava antiga não permanece; o deployment promovido está `Ready`, o alias
  `https://gril-lac.vercel.app` responde `200` em `/login` e não houve log de
  erro na janela de uma hora verificada.
- Validações não executadas e motivo: o teste pgTAP novo não foi executado
  contra o remoto; a homologação visual/WhatsApp real continua pendente.

## Impacto operacional

- Deploy necessário: sim, para expor o botão e a Server Action.
- Migração aplicada: sim, `20260806140816_restore_inbound_production.sql`.
- Compatibilidade/rollback: reverter código e migration restaura a separação
  anterior; nenhum dado operacional é removido.

## Pendências e riscos

- Repetir a homologação inbound em `shadow`, `assisted` e `production` com o
  roteiro humano.
- O modo permanece desligado por padrão; ativar `production` sem homologação
  continua bloqueado pelos gates técnicos.

## Documentos relacionados

- Decisões atualizadas: `docs/decisions/inbound-production-restored.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
