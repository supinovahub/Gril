# Limpeza do contexto de homologação

- Data: 05/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-slot-preservation-published`
- Commit: o commit que contém este arquivo

## Objetivo

Remover do Supabase remoto o contexto operacional criado para a homologação do fluxo do Pedro, conforme solicitado pelo usuário.

## Antes e depois

- Antes: havia um contato de homologação com 1 conversa, 22 mensagens, 1 oportunidade, 7 execuções de IA, 7 sugestões, 1 call, 7 reservas de capacidade, 61 jobs agendados e 16 eventos de outbox.
- Depois: o contato, a conversa, as mensagens e os registros operacionais associados foram removidos. A consulta pós-operação retornou zero para esses conjuntos e para os vínculos derivados verificados.

## Escopo executado

- Arquivos: este registro e a atualização de `docs/agent/CURRENT_STATE.md`; scripts SQL temporários foram removidos após a execução.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão transacional no projeto Supabase remoto `frslhzwhaooqtivkzdez`, incluindo dados de contato, conversa, mensagens, IA, oportunidade, agenda, reservas, jobs e outbox relacionados ao alvo identificado.
- Auditoria: `audit.events` não foi apagada; 33 eventos relacionados permaneceram após a operação.

## Validação

- Comandos/testes executados: consulta de identificação e contagem no Supabase remoto com `npx supabase db query --linked`; exclusão em transação; consulta pós-operação no mesmo banco.
- Evidência observada: `contacts`, `conversations`, `messages`, `ai_executions`, `ai_suggestions`, `opportunities`, `calls`, `call_holds`, reservas, requests, jobs, outbox e ingestão retornaram zero para o alvo. Não existem mais contatos com o nome usado no teste.
- Validações não executadas e motivo: não houve deploy nem testes de aplicação, pois a mudança foi exclusivamente uma limpeza de dados remotos.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a exclusão é irreversível por este procedimento; não há rollback automático. Os eventos de auditoria foram preservados.

## Pendências e riscos

- Nenhum conhecido. Um novo teste deve criar um lead novo, sem reutilizar o contexto removido.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não foi necessário alterar o fluxo de teste.
