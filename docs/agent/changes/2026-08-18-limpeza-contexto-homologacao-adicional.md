# Limpeza adicional de contexto de homologação

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `ops/cleanup-context-20260818-c` / PR draft a criar
- Commit: o commit que contém este arquivo

## Objetivo

Remover novamente, por solicitação explícita do usuário, somente o contexto operacional do contato de homologação identificado de forma exata no Supabase canônico, preservando a whitelist, as configurações da organização e a trilha de auditoria.

## Antes e depois

- Antes: o alvo exato possuía um contato, um telefone, uma oportunidade, uma conversa, nove mensagens, um anexo de áudio, quatro execuções de IA e um sinal de feedback associado. Havia também efeitos operacionais derivados ainda vinculados a esse contexto.
- Depois: contato, telefone, oportunidade, conversa, mensagens, anexo, execuções, sinal de feedback, efeitos derivados e o objeto físico de áudio foram removidos. A única entrada ativa da whitelist da organização permaneceu ativa e um recibo imutável da limpeza ficou preservado em auditoria.

## Escopo executado

- Arquivos: `docs/agent/CURRENT_STATE.md` e este registro.
- Migrations: nenhuma criada ou aplicada; o histórico local e remoto foi confirmado alinhado até `20260818170835` antes da operação.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: uma transação no Supabase `frslhzwhaooqtivkzdez` removeu exclusivamente o contexto selecionado; em seguida, um objeto foi removido do bucket privado `gril-media` pela Storage API. Nenhuma configuração, migration ou publicação Vercel foi alterada por esta limpeza.

## Validação

- Comandos/testes executados: preflight de concorrência em worktree isolada; `supabase migration list --linked --project-ref frslhzwhaooqtivkzdez`; consultas exatas antes e depois; execução integral em transação com `ROLLBACK`; repetição idêntica com `COMMIT`; remoção pela Storage API; `git diff --check` e busca por dados pessoais nos documentos versionados desta mudança.
- Evidência observada: a simulação selecionou exatamente um contato elegível e terminou com zero registros-alvo, mas o rollback restaurou um contato, uma conversa, nove mensagens, quatro execuções, um sinal e nenhum novo recibo. O commit removeu um contato, um telefone, uma oportunidade, uma conversa, nove mensagens, um anexo, quatro execuções de IA, doze eventos de outbox, setenta e um jobs agendados, um sinal de feedback e um objeto de storage. A verificação final encontrou zero contato, zero conversa e zero objeto físico do alvo, um recibo de auditoria e uma entrada ativa na whitelist da organização.
- Validações não executadas e motivo: lint, testes e build da aplicação não foram executados porque não houve alteração de código, schema ou dependências.

## Impacto operacional

- Deploy necessário: não para a limpeza; ela foi uma operação de dados e storage executada diretamente no ambiente canônico.
- Migração aplicada: não.
- Compatibilidade/rollback: a exclusão é destrutiva e o conteúdo removido não é recuperável pelo fluxo operacional. Uma nova mensagem do número preservado na whitelist cria um contexto novo. A simulação com rollback antecedeu o commit e a auditoria foi preservada.

## Pendências e riscos

- A função publicada de limpeza antecede a tabela `ai_feedback_signals` e não a inclui no catálogo próprio. O único sinal associado foi selecionado e removido na mesma transação, após eliminar eventuais vínculos restritivos, sem ampliar o alvo. Convém atualizar a rotina em uma mudança futura para incorporar essa tabela nativamente.

## Documentos relacionados

- Decisões atualizadas: nenhuma; não houve nova regra de produto.
- Guia de homologação atualizado: não; o procedimento humano e o contrato de limpeza não mudaram.
