# Correção da resposta para call futura já separada

- Data: 05/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-slot-preservation-published`
- Commit: o commit que contém este arquivo

## Objetivo

Impedir que Pedro diga que uma call futura já passou e ofereça novos horários quando o lead apenas escolhe vídeo ou telefone depois de um slot já separado.

## Antes e depois

- Antes: o banco preservava o slot, mas o modelo não recebia a call ativa como estado canônico. A resposta podia dizer que o horário passou, retornar `call_request: null` e induzir o lead a confirmar o mesmo horário novamente.
- Depois: o contexto do Pedro inclui `active_call`, a instrução exige preservar `starts_at` e respostas que contradizem uma call futura são regeneradas; se a segunda resposta continuar inconsistente, o turno não é enviado.

## Escopo executado

- Arquivos: `src/lib/runtime/worker.ts`, `src/lib/ai/pedro-turn.ts`, `src/lib/ai/pedro-turn.test.ts`, `src/lib/ai/pedro-instructions.ts`, `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Migrations: nenhuma; a proteção de idempotência do slot existente permanece válida.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta etapa; deploy de produção pendente de validação final.

## Validação

- Comandos/testes executados: teste direcionado de Pedro, `npm test`, `npm run lint`, `npm run build` e `git diff --check`.
- Evidência observada: 17 arquivos de teste e 97 testes passaram; lint e build Next.js 16.2.12 passaram com 46 rotas.
- Validações não executadas e motivo: homologação manual do WhatsApp ainda não foi feita; depende de nova conversa controlada após o deploy.

## Impacto operacional

- Deploy necessário: sim, para publicar o worker atualizado.
- Migração aplicada: não.
- Compatibilidade/rollback: calls sem slot ativo seguem o fluxo atual; calls futuras já separadas continuam protegidas pelo reaproveitamento transacional. Em caso de regressão, reverter o deployment para a versão anterior e depois o commit de código.

## Pendências e riscos

- Publicar em produção e confirmar o deployment `Ready`.
- Repetir o cenário controlado: escolher horário com menos de 30 minutos de antecedência, responder vídeo ou telefone e confirmar que texto e slot permanecem iguais.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção reforça a regra existente de slot canônico e ação estruturada.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
