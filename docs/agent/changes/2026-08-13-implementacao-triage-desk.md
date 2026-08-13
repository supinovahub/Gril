# Implementação real da mesa de triagem de Conversas

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `fix/implement-triage-desk`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir a lacuna entre a direção visual aprovada para a Triage Desk e a
implementação anterior, que mantinha uma lista genérica de conversas com
tratamento visual insuficiente para triagem operacional.

## Antes e depois

- Antes: a página apresentava linhas de conversa com avatar, mensagem e badges
  agrupados, sem sinais explícitos de mensagem nova ou sugestão do Pedro e sem
  uma leitura consistente por colunas.
- Depois: a página usa uma mesa de triagem com views compactas, busca alinhada,
  cabeçalho de colunas, sinal de mensagem nova/sugestão, hierarquia de pessoa,
  etapa, última mensagem, status, responsável e horário; no mobile, os mesmos
  dados são reordenados em uma sequência vertical legível.

## Escopo executado

- Arquivos: `src/app/app/conversas/page.tsx`,
  `src/app/app/conversas/conversas.module.css` e
  `src/components/ui/tabs.tsx`.
- Migrations: nenhuma.
- Mudanças externas: branch `fix/implement-triage-desk` publicada no GitHub;
  Preview Vercel criada no projeto `gril` do time `brio5` como deployment
  `dpl_4qge8HGMkZUPf4zUEBwTPZJ4xALQ`, status `READY`, URL
  `https://gril-h9b620ieb-brio5.vercel.app` e alias
  `https://gril-git-fix-implement-triage-desk-brio5.vercel.app`.
  Supabase e produção não foram alterados.

## Validação

- Comandos/testes executados: `git diff --check`, `npm run lint`, `npm test`,
  `npm run build`.
- Evidência observada: lint aprovado; 22 arquivos e 110 testes aprovados;
  build Next.js 16.2.12 compilado, TypeScript concluído e 47 rotas geradas.
  O build recebeu as variáveis públicas já existentes somente no ambiente do
  processo, sem gravá-las na worktree.
- Validações não executadas e motivo: homologação visual autenticada não foi
  executada nesta etapa; o protocolo do projeto mantém essa validação com o
  usuário.

## Impacto operacional

- Deploy necessário: sim, concluído somente na Preview da branch; a proteção
  de deployment redireciona acessos não autenticados para o SSO da Vercel.
- Migração aplicada: não.
- Compatibilidade/rollback: queries, filtros URL-backed, permissões, links,
  server actions e contratos de dados foram preservados; rollback é retornar
  ao commit anterior da branch ou remover a Preview.

## Pendências e riscos

- Homologar visualmente a rota `/app/conversas` autenticada em desktop e mobile.
- Confirmar com dados reais de homologação a leitura dos sinais de mensagem nova
  e sugestão pendente do Pedro.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não; a jornada funcional não mudou.
