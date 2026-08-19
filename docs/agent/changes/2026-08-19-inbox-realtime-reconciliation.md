# Reconciliação resiliente do Inbox em tempo real

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/inbox-realtime-reconciliation`; PR a registrar
- Commit: o commit que contém este arquivo

## Objetivo

Fazer novas mensagens aparecerem automaticamente no Inbox mesmo quando o
evento chega durante a conexão ou reconexão do Realtime, sem exigir F5.

## Antes e depois

- Antes: o cliente atualizava a rota somente quando recebia um evento depois de
  a assinatura estar pronta. Um evento perdido na janela entre o HTML inicial e
  o canal conectado deixava a lista antiga por tempo indeterminado.
- Depois: o evento continua sendo o caminho imediato, mas o cliente reconcilia
  ao confirmar assinatura e replicação, ao recuperar foco, visibilidade ou rede
  e, como proteção, a cada 30 segundos enquanto a aba estiver visível.

## Escopo executado

- Arquivos: política testável de atualização, componente Realtime do shell e
  testes unitários da assinatura, replicação e cadência de reconciliação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma nesta
  etapa; publicação será registrada após integração.

## Validação

- Comandos/testes executados: ESLint direcionado; teste unitário direcionado
  com três cenários; `npm run lint`; `npm test` com 25 arquivos e 120 testes; e
  `npm run build` com as 46 rotas.
- Evidência observada: no caso real reportado, o webhook persistiu a mensagem e
  o Supabase manteve `messages` e `conversations` na publicação Realtime, mas a
  lista só refletiu o registro após recarga manual. A nova política fecha essa
  janela e mantém uma reconciliação limitada quando o canal falha silenciosamente.
- Validações não executadas e motivo: homologação visual autenticada depende de
  uma nova mensagem controlada após a publicação. A primeira execução do build
  compilou e passou pelo TypeScript, mas não coletou páginas por ausência das
  variáveis públicas na worktree; a repetição carregou o `.env.local` canônico
  somente no processo e concluiu as 46 rotas.

## Impacto operacional

- Deploy necessário: sim.
- Migração aplicada: não.
- Compatibilidade/rollback: não altera payload, RPC, RLS nem dados. O rollback
  remove a reconciliação adicional e restaura o comportamento anterior.

## Pendências e riscos

- Confirmar em produção, com uma nova mensagem controlada, que a conversa muda
  de posição e mostra o preview sem recarregar a página.
- A proteção pode executar uma atualização adicional da rota a cada 30 segundos
  somente enquanto a aba estiver visível; a cadência é igual à já usada pelos
  contadores do workspace.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção cumpre o contrato já vigente.
- Guia de homologação atualizado: não; o guia já exige atualização automática
  sem F5 e reconciliação ao retornar para a aba.
