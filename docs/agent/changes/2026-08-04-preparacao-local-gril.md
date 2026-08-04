# Preparação local do Gril

- Data: 04/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `agent/fix-local-readiness`
- Commit: o commit que contém este arquivo

## Objetivo

Preparar este computador para trabalhar no Gril e alinhar o protocolo versionado ao perfil Vercel isolado disponível neste host.

## Antes e depois

- Antes: o checkout não tinha vínculos locais do Supabase ou da Vercel, não tinha dependências instaladas, o perfil Vercel documentado apontava para outro usuário Windows e o download das variáveis criptografadas deixava valores vazios.
- Depois: Supabase está vinculado a `frslhzwhaooqtivkzdez`, Vercel está vinculado a `brio5/gril`, 138 migrations locais/remotas estão alinhadas, dependências foram instaladas e o perfil documentado aponta para o perfil isolado deste host. Variáveis criptografadas continuam pendentes de preenchimento local seguro.

## Escopo executado

- Arquivos: `AGENTS.md` e este registro.
- Configuração local ignorada: `.vercel/project.json`, `supabase/.temp/project-ref`, `.env.local` e `node_modules`.
- Migrations: nenhuma criada ou aplicada.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: somente consultas, vínculo local, listagem de migrations, leitura de projeto e download local de variáveis; nenhuma alteração remota, login, logout, troca de conta ou deploy.

## Validação

- `git fetch origin` e branch própria criada sobre `origin/phase/01-foundation`.
- Supabase: projeto `frslhzwhaooqtivkzdez` ativo; 138 migrations, zero divergências, última `20260804180044`.
- Vercel: identidade `suporteinovahub-7501`; projeto `brio5/gril` acessível e vinculado.
- `npm ci`: 430 pacotes instalados, auditoria sem vulnerabilidades.
- `npm run lint`: aprovado.
- `npm test`: 19 arquivos e 108 testes aprovados.
- `npm run build`: aprovado quando a URL e a chave pública do Supabase foram injetadas somente no processo; a execução normal falhou porque variáveis Vercel criptografadas foram baixadas vazias.
- `git diff --check`: aprovado.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: configuração local é ignorada pelo Git; a alteração documental é reversível pelo Git.

## Pendências e riscos

- Preencher localmente, sem registrar no Git ou no chat, os valores criptografados necessários em `.env.local`.
- `UAZAPI_ALLOWED_HOSTS` permanece opcional para hosts públicos Uazapi.
- Remover o arquivo temporário externo `C:\Users\arthu\orca\Gril-node-modules-partial-20260804` após confirmar que não é necessário.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; o comportamento do produto não mudou.
