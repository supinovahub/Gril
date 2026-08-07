# Limpeza do contexto do lead Arthur Rocha

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `fix/invitation-confirmation-session`
- Commit: o commit que contém este arquivo

## Objetivo

Remover do Supabase remoto todo o contexto operacional do lead solicitado: mensagens, qualificações, IA, CRM, agenda, campanha, ingestão e artefatos derivados.

## Antes e depois

- Antes: havia 1 contato, 1 oportunidade, 1 conversa, 19 mensagens, 7 valores de qualificação, 7 itens de histórico, 7 solicitações de qualificação, 5 execuções de IA, 5 sugestões, 16 ações de IA, 1 call, 2 ofertas, 18 scores, 5 registros de mudança de etapa, 2 próximas ações, 1 vínculo de campanha, 1 linha de importação, 58 jobs, 12 eventos de outbox, 11 ingestões públicas, 146 payloads brutos de webhook e 2 reservas de capacidade.
- Depois: esses registros e os vínculos derivados foram removidos. A campanha compartilhada permaneceu com o outro contato; as definições globais de qualificação não foram alteradas.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`; o SQL temporário foi removido após a execução.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão transacional no projeto remoto canônico `frslhzwhaooqtivkzdez`, incluindo CRM, conversas, mensagens, qualificações, IA, call, campanha do contato, ingestões, jobs, outbox, reservas e payloads brutos relacionados.
- Auditoria: `audit.events` não foi apagada; a verificação encontrou 3 eventos relacionados preservados.

## Validação

- Comandos/testes executados: `git fetch origin`; `npx supabase migration list --linked`; consulta de identificação e contagens com `npx supabase db query --linked`; exclusão em transação; consulta pós-operação no mesmo banco.
- Evidência observada: zero para contato, telefone, oportunidade, conversa, mensagens, qualificações, IA, call, vínculo de campanha, linha de importação, ingestões, jobs, outbox e payloads brutos. Os vínculos derivados verificados também retornaram zero.
- Validações não executadas e motivo: `npm run lint`, `npm test` e `npm run build` não foram executados porque não houve mudança de código; não houve deploy.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a remoção é destrutiva e não possui rollback automático; a auditoria foi preservada conforme a regra do produto.

## Pendências e riscos

- Não recriar automaticamente o lead removido; uma nova homologação deve usar um lead novo.
- Os payloads brutos de webhook foram removidos no banco, mas provedores externos podem possuir retenções próprias fora do escopo do Supabase.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não foi necessário alterar o fluxo.
