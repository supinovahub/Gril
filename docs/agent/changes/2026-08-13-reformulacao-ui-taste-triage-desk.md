# Repaginação visual Gril — Ink, Paper, Signal / Triage Desk

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `preview/ui-ux-taste-20260813`
- Commit: o commit que contém este arquivo

## Objetivo

Substituir a primeira camada visual da preview, considerada fraca pelo usuário, por uma composição mais clara para um produto B2B de operações imobiliárias: shell com navegação de alto contraste, dashboard orientado à próxima ação e Conversas como mesa de triagem.

## Antes e depois

- Antes: canvas e sidebar com o mesmo peso visual, excesso de contêineres arredondados e pouca distinção entre atenção, métricas e conteúdo operacional.
- Depois: navegação em grafite, canvas papel mais silencioso, um único acento clay, ação de atenção dominante, métricas segmentadas e worklist de conversas com hierarquia de pessoa, mensagem, contexto e horário.

## Escopo executado

- Arquivos: tokens globais, shell autenticado, primitives compartilhadas, dashboard e Conversas; contexto do Superdesign em `.superdesign/`.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta etapa de código; variáveis de Preview foram apenas lidas localmente para validação.

## Validação

- Comandos/testes executados: `git diff --check`, `npm run lint`, `npm test`, `npm run build`; smoke visual com `agent-browser` em `/login` em desktop e viewport mobile.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados; build Next.js compilado, TypeScript concluído e 47 rotas geradas; browser sem overlay de erro e sem erros de console após carregar as variáveis locais canônicas.
- Validações não executadas e motivo: fluxo autenticado não foi exercitado localmente porque não houve credencial de usuário fornecida nesta etapa; a homologação autenticada continua necessária na preview pública.

## Impacto operacional

- Deploy necessário: sim, somente na preview da branch `preview/ui-ux-taste-20260813`; produção não foi alterada.
- Migração aplicada: não.
- Compatibilidade/rollback: rotas, aliases, labels, queries, server actions, permissões e contratos de dados foram preservados; rollback é retornar ao commit anterior da preview.

## Pendências e riscos

- Revisar o shell e as telas autenticadas com uma conta de homologação na URL pública.
- Validar visualmente as superfícies que ainda usam CSS próprio, especialmente Inbox detalhe, Agenda, Campanhas, Equipe e Pedro.
- A dependência local do repositório reportou duas vulnerabilidades altas no `npm ci`; não foram alteradas incidentalmente nesta tarefa.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; os fluxos de produto não mudaram.
