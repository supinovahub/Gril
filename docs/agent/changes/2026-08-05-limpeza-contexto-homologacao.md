# Limpeza completa do contexto de homologação

- Data: 05/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-slot-preservation-published`
- Commit: o commit que contém este arquivo

## Objetivo

Remover novamente o contexto operacional do lead usado na homologação, incluindo mensagens, IA, agenda, calls, histórico comercial e trabalhos pendentes.

## Antes e depois

- Antes: havia um contato de homologação com uma oportunidade, uma conversa, mensagens, resumos, execuções da IA, duas calls e vínculos derivados.
- Depois: o contato, a oportunidade, a conversa e os registros operacionais associados não existem mais no banco remoto. Os eventos de auditoria imutáveis foram preservados conforme a regra do produto.

## Escopo executado

- Arquivos: este registro e `docs/agent/CURRENT_STATE.md`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: remoção transacional no Supabase remoto do projeto canônico; jobs e eventos de outbox relacionados também foram removidos para impedir reprocessamento.

## Validação

- Comandos/testes executados: consulta de contagem antes e depois pelo Supabase CLI conectado ao projeto; verificação adicional de jobs, outbox, reservas privadas e auditoria.
- Evidência observada: contagens zeradas para contato, conversa, mensagens, resumos, execuções/ações da IA, calls, ofertas, aceite/distribuição, qualificações, histórico, scores, jobs, outbox e vínculos derivados; nenhum anexo existia. Onze eventos de auditoria relacionados permaneceram.
- Validações não executadas e motivo: deploy e smoke test público não foram executados porque a verificação da identidade Vercel canônica falhou com `EPERM`; o perfil obrigatório não existe neste host.

## Impacto operacional

- Deploy necessário: sim, a correção de código `db3fc4b` ainda aguarda publicação em produção; a limpeza do banco já foi aplicada remotamente.
- Migração aplicada: não aplicável.
- Compatibilidade/rollback: a remoção do contexto é destrutiva e não possui rollback automático; os eventos de auditoria não foram removidos.

## Pendências e riscos

- Publicar `db3fc4b` usando o perfil Vercel canônico em um host onde ele esteja disponível.
- Não recriar o lead de homologação automaticamente.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não aplicável.
