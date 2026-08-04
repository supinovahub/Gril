# Memória compartilhada entre agentes

- Data: 04/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `docs/shared-agent-memory`; PR criado na publicação desta mudança
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que desenvolvedores com contas diferentes do Codex reconstruam o mesmo contexto confiável pelo repositório, sem compartilhar conta, chat ou memória local.

## Antes e depois

- Antes: o `AGENTS.md` continha somente uma regra do Next.js; estado atual, histórico e decisões estavam espalhados, e o README já divergia da produção.
- Depois: agentes recebem um protocolo automático, um retrato corrente, registros independentes por mudança e um checklist de PR.

## Escopo executado

- Arquivos: `AGENTS.md`, `README.md`, `.github/pull_request_template.md` e `docs/agent/*`.
- Migrations: nenhuma.
- Mudanças externas: nenhuma alteração em Supabase ou Vercel; ambos foram consultados apenas para registrar o estado atual.

## Validação

- `git status`, branch padrão e origem GitHub conferidos.
- `npx supabase migration list --linked` confirmou migrations locais/remotas até `20260804180044`.
- Vercel `whoami` confirmou `suporteinovahub-7501`; deployment `dpl_FNnTMDPjaWgoX5S91ybK6bfSTwPN` estava `Ready`.
- `npm test`: 19 arquivos e 108 testes aprovados.
- Validação visual não necessária, pois não houve mudança de interface.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: somente documentação e instruções de trabalho; pode ser revertido pelo Git.

## Pendências e riscos

- O protocolo depende de cada agente iniciar no Git root e respeitar o `AGENTS.md`.
- GitHub Issues/PRs continuam necessários para evitar que duas pessoas assumam a mesma tarefa.

## Documentos relacionados

- Decisões atualizadas: nenhuma regra de produto foi alterada.
- Guia de homologação atualizado: não; o comportamento do produto não mudou.
