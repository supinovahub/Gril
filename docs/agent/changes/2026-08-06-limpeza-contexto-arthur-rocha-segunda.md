# Segunda limpeza do contexto de homologação

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-lead-time-timezone`
- Commit: o commit que contém este arquivo

## Objetivo

Remover novamente o contexto operacional criado para a homologação do lead de teste, sem apagar organização, campanha compartilhada, configurações globais ou trilha de auditoria.

## Antes e depois

- Antes: havia 1 contato, 1 telefone, 1 oportunidade, 1 conversa, 19 mensagens, 8 execuções de IA, 8 sugestões, 7 valores de qualificação, 7 itens de histórico, 1 call, 1 hold, 136 jobs e 19 eventos de outbox relacionados.
- Depois: o contato, telefone, oportunidade, conversa e vínculos derivados foram removidos; a consulta posterior retornou zero para o alvo em CRM, mensagens, IA, qualificações, agenda, reservas, ingestões, jobs e outbox.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`; o SQL temporário foi removido após a execução.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão transacional no projeto remoto canônico `frslhzwhaooqtivkzdez`.
- Auditoria: `audit.events` não foi apagada; os eventos existentes continuam preservados. Não havia evento com os IDs técnicos específicos do alvo.

## Validação

- Comandos/testes executados: `git fetch origin`; consultas somente leitura de identificação, dependências e contagens; exclusão em transação pelo Supabase CLI; consulta pós-operação.
- Evidência observada: zero para contato, telefone, oportunidade, conversa, mensagens, execuções/sugestões de IA, qualificações, call, hold, reservas, ingestões, jobs e outbox relacionados.
- Validações não executadas e motivo: testes de aplicação e deploy não foram executados porque a operação foi exclusivamente uma limpeza de dados remotos.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a remoção é destrutiva e não possui rollback automático; auditoria e demais dados da organização foram preservados.

## Pendências e riscos

- Não reutilizar o lead removido; uma nova homologação deve criar um lead novo com prefixo `HML-`.
- Provedores externos podem manter retenções próprias fora do escopo do Supabase.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não foi necessário alterar o fluxo.
