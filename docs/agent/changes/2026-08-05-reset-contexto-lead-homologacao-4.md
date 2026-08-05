# Nova limpeza do contexto de lead de homologacao

- Data: 05/08/2026
- Responsavel: Codex, a pedido do usuario
- Branch/PR: `agent/reset-lead-context-again-3`
- Commit: o commit que contem este arquivo

## Objetivo

Repetir a limpeza do contexto historico do lead usado na homologacao, preservando cadastro, oportunidade e a call operacional existente.

## Antes e depois

- Antes: havia mensagens, resumos, execucoes e requisicoes da IA, qualificacoes, escaladas e historico de controle associados a conversa.
- Depois: o contexto historico foi removido; a conversa ficou pausada com a IA desligada e a call permaneceu atribuida.

## Escopo executado

- Arquivos: somente este registro operacional.
- Migrations: nenhuma.
- Mudancas externas em Supabase, Vercel, GitHub ou fornecedores: limpeza transacional no Supabase remoto de mensagens, resumos, execucoes/requisicoes/sugestoes de IA, qualificacoes, historico de qualificacoes, escaladas, takeover requests, ingestao de webhooks, jobs e outbox associados ao contexto. O cadastro, a oportunidade e a call foram preservados.

## Validacao

- Comandos/testes executados: `npx supabase db query --linked --file supabase/tmp-reset-arthur-context.sql --output-format json`; consulta imediata de verificacao; consulta de verificacao apos 5 segundos; `git status --short --branch`.
- Evidencia observada: mensagens, resumos, execucoes/requisicoes/sugestoes de IA, qualificacoes, historico, escaladas, takeover requests, ingestao e jobs pendentes iguais a zero; contexto da oportunidade ausente; cadastro ativo; oportunidade aberta; conversa pausada, humana e com IA desligada; call preservada como atribuida.
- Validacoes nao executadas e motivo: lint, testes e build nao se aplicam a uma limpeza de dados sem alteracao de codigo ou migration.

## Impacto operacional

- Deploy necessario: nao.
- Migracao aplicada: nao.
- Compatibilidade/rollback: a limpeza de dados historicos nao e reversivel pelo aplicativo; entidades operacionais preservadas permanecem disponiveis para a homologacao.

## Pendencias e riscos

- Nenhum para a limpeza solicitada. A conversa permanece pausada para impedir reprocessamento automatico de mensagens antigas.

## Documentos relacionados

- Decisoes atualizadas: nenhuma.
- Guia de homologacao atualizado: nao se aplica.
