# Fluxo canônico antes de correções funcionais

- Data: 04/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `agent/canonical-correction-flow`; PR criado na publicação
- Commit: o commit que contém este arquivo

## Objetivo

Garantir que um Codex sem acesso ao histórico privado da sessão reconstrua o comportamento correto antes de corrigir um defeito.

## Antes e depois

- Antes: o protocolo exigia consultar documentação relevante, mas não tornava explícita a comparação entre os sete arquivos originais, decisões posteriores, implementação e comportamento observado.
- Depois: toda correção funcional segue essa comparação; bug inequívoco continua rápido, enquanto lacuna ou mudança de produto exige discussão prévia.

## Escopo executado

- Arquivos: `AGENTS.md`, `docs/agent/README.md`, `docs/agent/CURRENT_STATE.md` e `docs/agent/ONBOARDING_PROMPTS.md`.
- Migrations: nenhuma.
- Mudanças externas: nenhuma.

## Validação

- Referências locais e instruções revisadas.
- `git diff --check` executado antes da publicação.
- Testes de aplicação não são necessários porque a mudança é exclusivamente documental.
- Validação visual não se aplica.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: documentação versionada, reversível pelo Git.

## Pendências e riscos

- A eficácia depende de o novo chat ser aberto na raiz do repositório após atualizar a branch padrão.

## Documentos relacionados

- Decisões atualizadas: nenhuma regra funcional do produto mudou.
- Guia de homologação atualizado: não; somente o processo de engenharia mudou.
