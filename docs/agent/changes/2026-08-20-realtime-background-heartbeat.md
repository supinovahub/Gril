# Realtime resiliente em abas do navegador em segundo plano

- Data: 2026-08-20
- Responsável: Codex
- Branch/PR: `fix/realtime-background-heartbeat` / PR ainda não aberto
- Commit: o commit que contém este arquivo

## Objetivo

Evitar que o Chrome interrompa silenciosamente a conexão Realtime do dashboard quando a aba permanece em segundo plano, preservando a atualização ao vivo e o disparo sonoro das novas mensagens recebidas.

## Antes e depois

- Antes: o cliente Supabase do navegador usava os temporizadores da thread principal para os heartbeats do Realtime. O Chrome pode limitar esses temporizadores em abas ocultas, causando desconexão silenciosa; ao voltar para a aba, a reconciliação por foco/visibilidade atualizava as mensagens, reproduzindo o sintoma relatado.
- Depois: o cliente compartilhado do navegador habilita `realtime.worker`, mantendo os heartbeats em Web Worker. A reconciliação existente continua sendo a proteção para retorno de foco/reconexão e não emite sons retroativos.

## Escopo executado

- Arquivos: `src/lib/supabase/client.ts`, `src/lib/supabase/client.test.ts` e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma. GitHub, Supabase, Vercel e a aplicação em produção foram apenas consultados para diagnóstico.

## Validação

- Comandos/testes executados: `npm ci`; teste Vitest direcionado ao cliente Supabase; ESLint direcionado; `npm run lint`; `npm test`; `npm run build`; inspeção do bundle gerado; consulta SQL somente leitura à publicação Realtime; `git diff --check`.
- Evidência observada: lint concluído sem erros; 28 arquivos e 131 testes aprovados; build Next.js 16.2.12 concluído com TypeScript e 46 rotas; o bundle do navegador contém `realtime: { worker: true }`; o teste novo garante que essa opção seja repassada a `createBrowserClient`; as tabelas `messages` e `conversations` continuam presentes em `supabase_realtime` no projeto canônico.
- Validações não executadas e motivo: o teste humano completo com uma nova mensagem real enquanto o Chrome permanece em segundo plano depende de uma versão publicada/autenticada. Esta branch ainda não foi enviada nem implantada. Nenhuma mensagem de teste foi criada no ambiente único de produção.

## Impacto operacional

- Deploy necessário: sim, depois de revisão e integração na branch padrão.
- Migração aplicada: não se aplica.
- Compatibilidade/rollback: não altera schema, RLS nem contrato de produto. O rollback consiste em remover a opção `realtime.worker` do cliente Supabase do navegador.

## Pendências e riscos

- Validar após a publicação, no Chrome, uma mensagem recebida com a aba em segundo plano por tempo suficiente para exercitar a limitação de temporizadores.
- O áudio continua sujeito à política do navegador que exige interação prévia do usuário e à preferência local de som. Navegador totalmente fechado continua fora do escopo, pois a funcionalidade não é notificação push do sistema operacional.
- `npm ci` informou duas vulnerabilidades de severidade alta na árvore atual de dependências; nenhuma dependência ou lockfile foi alterado nesta correção e não foi executado `npm audit fix` por estar fora do escopo.

## Documentos relacionados

- Decisões atualizadas: nenhuma. `docs/decisions/2026-08-19-notificacoes-mensagens-navegador.md` já define o comportamento canônico preservado por esta correção.
- Guia de homologação atualizado: não. O cenário de aba oculta e reconexão já está coberto em `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
