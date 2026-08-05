# Limpeza repetida do contexto de lead de homologacao

- Data: 05/08/2026
- Responsavel: Codex, a pedido do usuario
- Branch/PR: `agent/reset-lead-context-again-2`
- Commit: o commit que contem este arquivo

## Objetivo

Repetir a limpeza do contexto historico do lead de homologacao solicitado, preservando o cadastro e a oportunidade para nova homologacao.

## Antes e depois

- Antes: havia mensagens, resumos, execucoes e dados auxiliares de IA/qualificacao associados ao atendimento.
- Depois: o historico operacional e o contexto da oportunidade foram removidos; cadastro e oportunidade foram preservados.

## Escopo executado

- Arquivos: somente este registro operacional.
- Migrations: nenhuma.
- Mudancas externas em Supabase, Vercel, GitHub ou fornecedores: limpeza transacional no Supabase remoto do contexto, mensagens, resumos, execucoes/requisicoes de IA, sugestoes, qualificacoes, historico de qualificacoes, ingestao de webhooks, entregas de midia e jobs pendentes associados ao atendimento. A conversa foi mantida pausada, com ownership humano, IA desligada e motivo `context_reset_manual`.

## Validacao

- Comandos/testes executados: `npx supabase db query --linked --file supabase/tmp-reset-arthur-context.sql --output-format json`; consulta de verificacao apos 5 segundos; `git status --short --branch`.
- Evidencia observada: contagens de mensagens, resumos, execucoes/requisicoes de IA, sugestoes, qualificacoes, historico, ingestao e jobs pendentes iguais a zero; contexto da oportunidade ausente; cadastro ativo; oportunidade aberta; conversa pausada, humana e com IA desligada.
- Validacoes nao executadas e motivo: lint, testes e build nao se aplicam a uma limpeza de dados sem alteracao de codigo ou migration.

## Impacto operacional

- Deploy necessario: nao.
- Migracao aplicada: nao.
- Compatibilidade/rollback: a limpeza de dados historicos nao e reversivel pelo aplicativo; cadastro, oportunidade e versao institucional de contexto foram preservados.

## Pendencias e riscos

- Nenhum para a limpeza solicitada. A conversa permanece pausada para impedir reprocessamento automatico de mensagens antigas.

## Documentos relacionados

- Decisoes atualizadas: nenhuma.
- Guia de homologacao atualizado: nao se aplica.
