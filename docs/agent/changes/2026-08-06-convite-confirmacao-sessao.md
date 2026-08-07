# Correção do retorno da confirmação de convite

- Data: 06/08/2026
- Responsável: Codex
- Branch/PR: `agent/fix-call-result-revocation`
- Commit: o commit que contém este arquivo

## Objetivo

Fazer o link de confirmação de e-mail de um corretor recém-cadastrado pelo convite autenticar o e-mail convidado e retornar ao convite, mesmo quando o navegador tinha outra conta localmente autenticada.

## Antes e depois

- Antes: o retorno podia perder o convite quando a confirmação chegava sem `next`, e a sessão local anterior podia continuar sendo usada; a troca de conta também encerrava sessões globais.
- Depois: o fluxo recupera o convite pelo cookie pendente, encerra somente a sessão local anterior durante a confirmação e troca de conta, preserva o retorno seguro para `/convite/[token]` e impede cache das respostas de confirmação.

## Escopo executado

- Arquivos: `src/lib/auth/pending-invitation.ts`, `src/lib/auth/pending-invitation.test.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/app/aceitar-convite/[token]/actions.ts`, `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e `docs/agent/CURRENT_STATE.md`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados: `git fetch origin`, `git diff --check`, `npm test`, `npm run lint` e `npm run build`.
- Evidência observada: 98 testes aprovados; lint aprovado; build Next.js 16.2.12 aprovado com 46 rotas.
- Validações não executadas e motivo: confirmação ponta a ponta com e-mail real, conta previamente autenticada e convite real depende de homologação manual pelo usuário; não houve alteração remota nem deploy.

## Impacto operacional

- Deploy necessário: sim, para disponibilizar a correção em produção; não executado.
- Migração aplicada: não aplicável.
- Compatibilidade/rollback: fluxo sem convite mantém os destinos existentes; rollback consiste em reverter os cinco arquivos de aplicação, sem alteração de banco.

## Pendências e riscos

- Confirmar que o template de confirmação do Supabase preserva o `redirectTo` configurado pelo cadastro.
- Homologar com conta nova e telefone autorizado; depois confirmar que o WhatsApp ainda precisa ser salvo e aceito antes da ativação final, conforme regra do convite individual.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção implementa a regra existente de convite individual e sessão segura.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção 5.1.
