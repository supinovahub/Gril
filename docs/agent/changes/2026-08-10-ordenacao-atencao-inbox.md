# Ordenação do Inbox por atenção

- Data: 10/08/2026
- Responsável: Codex
- Branch/PR: `mathdias2020/Inbox-ordem`
- Commit: o commit que contém este arquivo

## Objetivo

Evitar que conversas com mensagens não lidas ou sugestões abertas da IA fiquem
perdidas abaixo de conversas sem pendência no Inbox.

## Antes e depois

- Antes: a rota buscava no máximo 100 conversas e ordenava apenas por
  `updated_at DESC`; os indicadores de não lidas e sugestões eram usados
  somente como badge.
- Depois: conversas com qualquer pendência de atenção aparecem primeiro e,
  dentro de cada grupo, a atividade mais recente aparece primeiro. Pendências
  fora dos 100 itens recentes são buscadas antes do limite final.

## Escopo executado

- Arquivos: `src/app/app/inbox/page.tsx`,
  `src/lib/inbox/sorting.ts`, `src/lib/inbox/sorting.test.ts`, decisão,
  guia, estado corrente e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma; foi
  feito apenas o `git fetch origin` obrigatório antes da alteração.

## Validação

- Comandos/testes executados: teste direcionado do comparador (2 testes),
  `npm run lint`, `npm test` (21 arquivos, 108 testes), `npm run build` e
  revisão de codificação UTF-8.
- Evidência observada: lint passou; todos os 108 testes passaram; o build
  compilou o bundle e concluiu a verificação TypeScript.
- Validações não executadas e motivo: a coleta de páginas do build falhou
  depois da compilação por ausência de `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` neste workspace. Homologação visual
  autenticada e verificação em produção não foram executadas, pois não houve
  deploy.

## Impacto operacional

- Deploy necessário: sim, para disponibilizar a nova ordem no Inbox.
- Migração aplicada: não há migration.
- Compatibilidade/rollback: alteração restrita à leitura/ordenação da lista;
  reverter a página e o comparador restaura a ordem anterior. O contador e o
  fluxo de leitura/revisão continuam usando os mesmos dados e actions.

## Pendências e riscos

- Executar o build em ambiente com as variáveis públicas do Supabase.
- Homologar manualmente uma pendência antiga fora dos 100 itens mais recentes,
  uma não lida, uma sugestão `assisted` pendente e a remoção de cada pendência.
- O carregamento complementar usa uma consulta por IDs das conversas com
  atenção; se o volume de pendências crescer muito, deve ser substituído por
  uma consulta paginada/ordenada no banco.

## Documentos relacionados

- Decisão atualizada: `docs/decisions/inbox-attention-order.md`.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
