# Transição do desenvolvedor principal

- Data: 2026-08-24
- Responsável: Codex, a pedido do desenvolvedor principal em transição
- Branch/PR: `docs/developer-transition-handoff` / PR #79
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que outro desenvolvedor assuma o Gril sem depender de histórico de chat ou memória local, com atenção especial ao conserto da conversa do Pedro, aos objetivos do produto, ao estado vivo dos ambientes e à sequência segura de continuidade.

## Antes e depois

- Antes: o contexto estava distribuído entre pacote de produto, decisões, estado corrente, registros de mudança, código, PRs antigas e fornecedores; não havia um handoff único nem um runbook dedicado ao núcleo conversacional.
- Depois: existe um ponto de entrada de transição, um runbook da conversa e um prompt específico de assunção, todos ligados à memória compartilhada dos agentes.

## Escopo executado

- Arquivos:
  - `docs/agent/DEVELOPER_HANDOFF.md`;
  - `docs/operations/AI_CONVERSATION_RUNBOOK.md`;
  - `docs/agent/README.md`;
  - `docs/agent/ONBOARDING_PROMPTS.md`;
  - este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma. GitHub, Supabase e Vercel foram consultados somente em modo leitura para formar o retrato de 24/08/2026.

## Validação

- Comandos/testes executados: `git diff --check`; verificação dos caminhos de código, testes e migrations citados; verificação de links Markdown locais; leitura UTF-8 dos cinco documentos alterados; preflight de concorrência contra a branch padrão e as PRs abertas.
- Evidência observada: todos os caminhos documentados existem, nenhum link local está quebrado, os arquivos não contêm caractere de substituição de encoding e nenhuma PR aberta altera os mesmos cinco caminhos. O handoff diferencia estado comprovado, trabalho pendente e decisões de produto; o runbook mapeia entrada, runtime, saída estruturada, assisted, diagnóstico, homologação, publicação e rollback.
- Validações não executadas e motivo: lint, testes e build da aplicação não foram executados porque a mudança é exclusivamente Markdown e não altera código, dependências, banco ou runtime.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: documentação aditiva; pode ser revertida sem alterar runtime, dados ou produção.

## Pendências e riscos

- O retrato ao vivo expira e precisa ser revalidado pelo sucessor.
- A correção da divergência de horário continua pendente; este trabalho não altera código funcional.
- As decisões sobre duração comunicada/reservada e apresentação como corretor continuam com o responsável de produto.
- PRs antigas e filas pendentes foram documentadas, não limpas nem encerradas.

## Documentos relacionados

- Decisões atualizadas: nenhuma; nenhuma nova regra de produto foi criada.
- Guia de homologação atualizado: não; o runbook novo referencia o guia existente e registra uma divergência documental de capacidade para correção separada, evitando conflito com PRs abertas.
