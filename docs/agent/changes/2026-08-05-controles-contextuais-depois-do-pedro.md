# Controles contextuais depois da análise do Pedro

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/contextual-control-intents` / PR pendente
- Commit: o commit que contém este arquivo

## Objetivo

Eliminar pausas e handoffs causados por palavras isoladas, garantindo que Pedro analise o contexto da conversa antes de qualquer regra comportamental.

## Antes e depois

- Antes: o worker executava uma regex antes da OpenAI; `pagar` em uma resposta de orçamento pausou Arthur como `payment` sem execução da IA.
- Depois: mensagens elegíveis seguem para a análise contextual; a saída estruturada registra categoria, evidência e confiança, e os efeitos críticos são aplicados depois, de forma idempotente.

## Escopo executado

- Arquivos: worker, instruções e schema do Pedro, testes, decisões, rastreabilidade e guia de homologação.
- Migrations: `20260805150835_contextual_controls_after_pedro_analysis.sql` e `20260805152133_disable_legacy_pre_ai_controls.sql`.
- Mudanças externas: migration contextual aplicada no Supabase `frslhzwhaooqtivkzdez`; a desativação das funções legadas será aplicada depois do deploy do novo worker.

## Validação

- Executados: testes direcionados, `npm test`, `npm run lint`, `npm run build`, `git diff --check` e `supabase db push --linked --dry-run`.
- Evidência: 18 arquivos e 104 testes aprovados; build com 46 rotas; somente a migration desta correção aparece pendente no dry-run.
- Não executado ainda: homologação real do novo turno do Arthur, que depende da publicação e do reprocessamento controlado da mensagem.

## Impacto operacional

- Deploy necessário: sim.
- Migração necessária: sim, aditiva, com rastreabilidade e idempotência da escalada por execução.
- Rollback: reverter o worker e restaurar a função anterior; as colunas aditivas podem permanecer sem afetar fluxos antigos.

## Pendências e riscos

- Publicar a aplicação e reprocessar a última mensagem do Arthur uma vez.
- Homologar os cenários contextuais registrados no guia.

## Documentos relacionados

- `docs/decisions/contextual-controls-after-ai.md`.
- `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md`.
- `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
