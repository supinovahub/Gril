# Publicação da reconciliação Realtime do Inbox

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: implementação em `fix/inbox-realtime-reconciliation`, PR #72;
  registro em `docs/record-inbox-realtime-production`
- Commit: o commit que contém este arquivo; implementação integrada por
  `9d2ef6f5429ac13dd42588c3a48ea721f160b200`

## Objetivo

Registrar a publicação da correção que faz novas mensagens aparecerem no Inbox
sem F5 mesmo quando um evento coincide com a conexão ou reconexão do Realtime.

## Antes e depois

- Antes: uma mensagem já persistida podia não aparecer na lista quando o
  cliente perdia o evento antes de a assinatura ficar pronta; não havia
  reconciliação periódica da rota.
- Depois: eventos continuam atualizando imediatamente, e o cliente também
  reconcilia ao confirmar assinatura/replicação, ao recuperar foco,
  visibilidade ou rede e a cada 30 segundos enquanto a aba estiver visível.

## Escopo executado

- Arquivos: componente e política Realtime do shell, teste unitário e registro
  da implementação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: PR #72
  mergeado; deployment Vercel `dpl_FH55P5iHKRL8XsM6NmVS7Avw3gKE` publicado em
  produção.

## Validação

- Comandos/testes executados: `npm run lint`; `npm test` com 25 arquivos e 120
  testes; `npm run build` com as 46 rotas; checks do PR; inspeção do deployment;
  smoke HTTP do alias; consulta de logs de runtime.
- Evidência observada: o deployment está `READY`, atende
  `https://gril-lac.vercel.app`, corresponde ao deployment GitHub do commit
  canônico, `/login` responde 200, `/app/inbox` responde 307 para autenticação e
  não houve log `error` nem `fatal` no período pós-deploy.
- Validações não executadas e motivo: uma nova mensagem controlada com a Inbox
  aberta ainda precisa confirmar visualmente a atualização sem F5.

## Impacto operacional

- Deploy necessário: concluído pela integração Git/Vercel.
- Migração aplicada: não.
- Compatibilidade/rollback: nenhum contrato de banco, RLS, RPC ou payload foi
  alterado. O rollback exige reverter o commit e publicar novo deployment.

## Pendências e riscos

- Homologar manualmente com uma nova mensagem controlada, mantendo a lista do
  Inbox aberta e sem recarregar a página.
- `docs/agent/CURRENT_STATE.md` não foi alterado neste registro porque há vários
  PRs e worktrees ativos modificando o mesmo arquivo; o registro independente
  preserva a rastreabilidade sem sobrescrever trabalho concorrente.

## Documentos relacionados

- Decisões atualizadas: nenhuma; o contrato já exigia atualização automática.
- Guia de homologação atualizado: não; o cenário sem F5 já está documentado em
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
