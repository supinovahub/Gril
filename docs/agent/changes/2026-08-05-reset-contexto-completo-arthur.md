# Limpeza completa do contexto de homologação do lead Arthur

- Data: 05/08/2026
- Responsável: Codex, a pedido do usuário
- Branch/PR: `agent/delete-arthur-context-20260805`
- Commit: o commit que contém este arquivo

## Objetivo

Remover todo o histórico operacional do lead de homologação, incluindo mensagens, contexto e execuções da IA, follow-ups, jobs, qualificações, mídia, calls/reuniões e registros derivados.

## Antes e depois

- Antes: havia mensagens, registros da IA, qualificações, jobs, entregas de mídia, histórico de pipeline e uma call associada.
- Depois: o histórico operacional foi removido; o contato, seu telefone principal, a oportunidade e a conversa permaneceram como shells para nova homologação. A oportunidade voltou ao estágio `new`; a conversa ficou pausada, humana e com IA desligada.

## Escopo executado

- Arquivos: este registro operacional.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: limpeza transacional no Supabase remoto de mensagens, resumos e contexto da conversa, execuções/requisições/sugestões/ações da IA, qualificações e histórico, matches e snapshots de projetos, entregas de mídia, follow-ups e jobs, outbox, capacidade, webhook ingest, calls/reuniões e todos os registros de distribuição/resultados associados, histórico de pipeline, scores, solicitações do lead e supressões vinculadas ao telefone. Foi preservado um evento de auditoria da limpeza.

## Validação

- Comandos/testes executados: consultas remotas de identificação e contagem; limpeza em uma transação; consulta de verificação após a transação; `git status --short --branch`.
- Evidência observada: 0 mensagens, 0 calls, 0 registros derivados de calls, 0 execuções/requisições/sugestões da IA, 0 qualificações, 0 entregas de mídia, 0 jobs, 0 outbox events, 0 histórico de pipeline, 0 scores e 0 suppressions; 1 contato, 1 telefone, 1 oportunidade e 1 conversa shell preservados.
- Validações não executadas e motivo: `npm run lint`, `npm test` e `npm run build` não se aplicam a uma limpeza de dados sem alteração de código ou migration.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: o histórico apagado não é restaurável pelo aplicativo; os shells preservados permitem iniciar nova homologação. A auditoria da limpeza permanece registrada.

## Pendências e riscos

- Nenhum para a limpeza solicitada. A conversa permanece pausada e com IA desligada até uma retomada operacional explícita.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não se aplica.
