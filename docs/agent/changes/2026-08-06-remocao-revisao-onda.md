# Remoção da revisão individual da onda de campanha

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `feat/pedro-inbound-whitelist`
- Commit: o commit que contém este arquivo

## Objetivo

Permitir a liberação da onda de 50 sem exigir aprovação cliente por cliente da
primeira onda, conforme solicitação explícita do produto.

## Antes e depois

- Antes: a primeira onda criava uma revisão obrigatória por contato e a próxima
  onda falhava com `previous_campaign_wave_review_required` até todos os itens
  serem aprovados.
- Depois: ondas futuras não criam itens de revisão, não consultam a aprovação da
  onda anterior e são liberadas diretamente pelo botão explícito da campanha.

## Escopo

- Migration: `20260806180518_remove_campaign_wave_review_gate.sql`.
- Interface: removida a lista de revisão por contato e as ações correspondentes.
- Operação: mantidas revalidação de telefone, opt-out, supressão, conexão ativa,
  pausa e limites de volume.
- Histórico: tabelas de revisão não foram apagadas; solicitações antigas passam
  a ser registradas como desabilitadas.

## Validação e publicação

- `npx eslint src`: aprovado.
- `npm test`: 36 arquivos e 200 testes aprovados.
- `npm run build`: aprovado com 46 rotas.
- `npx supabase db lint --linked --fail-on error`: aprovado; somente avisos
  preexistentes.
- Simulação transacional da migration: aprovada e revertida antes da aplicação.
- Supabase remoto: migration aplicada; executor sem
  `previous_campaign_wave_review_required`, sem ondas pendentes de revisão e
  com 14 registros históricos preservados.
- Vercel: commit `a68701c` publicado e promovido no deployment
  `dpl_2C2rC72vcxhnoPbWQxQGTD9DZXmh`, alias `https://gril-lac.vercel.app`,
  status `Ready`.
- Homologar com uma campanha `HML-` antes de disparar contatos reais.

## Riscos e pendências

- A remoção reduz uma barreira operacional deliberadamente; o primeiro envio
  deve continuar limitado ao volume da onda e com Pedro em `shadow` ou
  `assisted` conforme o protocolo de homologação.
- A decisão original de revisão individual é substituída pela decisão
  `docs/decisions/campaign-wave-review-gate-disabled.md`.
