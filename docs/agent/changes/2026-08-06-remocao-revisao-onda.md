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

## Validação

- Executar `npx eslint src`, `npm test`, `npm run build`, `npx supabase db lint
  --linked --fail-on error` e simulação transacional da migration antes da
  publicação.
- Confirmar no banco que o executor não contém
  `previous_campaign_wave_review_required`, que a nova onda grava
  `review_required_count=0` e que a interface não exibe revisão individual.
- Homologar com uma campanha `HML-` antes de disparar contatos reais.

## Riscos e pendências

- A remoção reduz uma barreira operacional deliberadamente; o primeiro envio
  deve continuar limitado ao volume da onda e com Pedro em `shadow` ou
  `assisted` conforme o protocolo de homologação.
- A decisão original de revisão individual é substituída pela decisão
  `docs/decisions/campaign-wave-review-gate-disabled.md`.
