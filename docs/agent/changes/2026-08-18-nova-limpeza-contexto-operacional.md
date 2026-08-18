# Nova limpeza do contexto operacional solicitado

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `ops/cleanup-context-20260818-b`
- Commit: o commit que contém este arquivo

## Objetivo

Remover novamente do Supabase canônico o contexto operacional de um único contato de homologação solicitado pelo usuário, incluindo os arquivos de áudio associados, sem apagar whitelist, configuração compartilhada da organização ou trilha de auditoria.

## Antes e depois

- Antes: a identificação exata retornou 1 contato, 1 telefone, 1 oportunidade, 1 conversa, 18 mensagens, 5 anexos, 10 execuções de IA, 9 sugestões de IA, 2 sinais de feedback de IA, 192 jobs, 34 eventos de outbox e 5 objetos no Storage.
- Depois: contato, telefone, oportunidade, conversa e registros derivados foram expurgados; as verificações específicas retornaram zero para contato, telefone, conversa, mensagens, execuções e sinais de IA e objetos no Storage. A única entrada ativa da whitelist da organização permaneceu ativa.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`; os arquivos SQL/JavaScript temporários, que continham somente identificadores técnicos, foram removidos após a execução.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: exclusão transacional no projeto remoto canônico `frslhzwhaooqtivkzdez` e remoção de 5 arquivos do bucket de mídia pela API do Supabase Storage.
- A rotina protegida de limpeza foi reutilizada após isolar exatamente o alvo. Como a tabela `ai_feedback_signals` foi criada depois dessa rotina, 2 sinais associados foram removidos explicitamente, com seus vínculos de revisão/agregação, na mesma transação antes do expurgo principal.
- `audit.events`, `ai_test_allowlist`, organização, operações, integrações e demais configurações compartilhadas não foram apagadas.

## Validação

- Comandos/testes executados: `git fetch origin`; preflight de worktree; `npx supabase migration list --linked --output-format json`; consultas somente leitura de identificação, dependências, whitelist e definições vivas; simulação integral em transação com `ROLLBACK`; conferência da restauração; repetição idêntica com `COMMIT`; remoção pela API de Storage; consultas finais no banco e no catálogo do Storage.
- Evidência observada: o ensaio levou contato, telefone, conversa e sinais de IA a zero e o rollback restaurou 1 contato, 1 conversa, 18 mensagens e 2 sinais; o commit produziu recibo `status=purged`, preservou auditoria e deixou zero nos alvos consultados. A API removeu 5 de 5 objetos e a consulta posterior confirmou zero objeto residual. A whitelist continuou com 1 entrada ativa.
- Validações não executadas e motivo: `npm run lint`, `npm test`, `npm run build`, db lint e deploy não foram executados porque não houve alteração de código, schema ou artefato implantável.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a exclusão de dados e arquivos é destrutiva e não possui rollback automático. Uma nova mensagem do número ainda allowlisted pode criar um contexto limpo novamente.

## Pendências e riscos

- A rotina publicada `purge_homologation_context` ainda não cataloga nem remove `ai_feedback_signals`, adicionada posteriormente. Um contexto HML- que possua esses sinais pode falhar no botão de limpeza até uma migration futura atualizar a rotina.
- Provedores externos podem manter retenções próprias fora do Supabase e do escopo desta operação.

## Documentos relacionados

- Decisões atualizadas: nenhuma; não houve nova regra de produto.
- Guia de homologação atualizado: não; o fluxo humano não mudou. A incompatibilidade técnica encontrada ficou registrada como pendência acima.
