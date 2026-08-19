# Notificações de novas mensagens no navegador

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `feat/browser-message-notifications`; PR a registrar
- Commit: o commit que contém este arquivo

## Objetivo

Avisar imediatamente o usuário do workspace quando uma nova mensagem chegar,
com som semelhante ao comportamento do WhatsApp Web e contador no título da
aba do Chrome, sem exigir F5.

## Antes e depois

- Antes: o Inbox atualizava a rota e os badges via Realtime/reconciliação, mas
  não havia som nem informação de pendências no título da aba.
- Depois: um `INSERT` inbound toca um aviso sonoro local, o título acompanha o
  contador canônico do Inbox, alterações relevantes antecipam a atualização
  dos badges e o usuário pode silenciar o som com preferência persistida no
  navegador.

## Escopo executado

- Arquivos: política e testes de notificação, sintetizador Web Audio,
  assinatura Realtime global carregada sob demanda, botão de som, integração
  com o provedor de contagens e shell; decisão de produto e guia de
  homologação.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: consulta
  somente leitura confirmou que `messages`, `ai_suggestions` e
  `conversation_read_states` estão na publicação `supabase_realtime`; nenhum
  estado externo foi alterado.

## Validação

- Comandos/testes executados: teste unitário direcionado com oito cenários;
  ESLint direcionado; `npm run lint`; `npm test` com 27 arquivos e 128 testes;
  e `npm run build` com TypeScript e as 46 rotas do Next.js 16.2.12.
- Evidência observada: os testes confirmaram título sem contador, com contador
  e limite `99+`; filtro exclusivo de inbound; som habilitado por padrão e
  preferência local; deduplicação temporária e limitada por ID de mensagem.
- Validações não executadas e motivo: a homologação sonora autenticada exige
  uma mensagem controlada no Chrome e permanece como etapa manual, sem
  automação da sessão do usuário. O build carregou o `.env.local` canônico
  somente no processo, sem copiar ou registrar segredos na worktree.

## Impacto operacional

- Deploy necessário: sim, para disponibilizar a funcionalidade.
- Migração aplicada: não.
- Compatibilidade/rollback: não altera payloads, RPCs, RLS ou dados. O rollback
  remove os componentes de notificação e restaura o título normal; chaves
  locais versionadas podem permanecer sem efeito.

## Pendências e riscos

- Homologar em uma sessão autenticada no Chrome após o deploy, incluindo duas
  abas e uma mensagem inbound autorizada.
- O primeiro som depende de uma interação prévia permitida pela política de
  autoplay do navegador. O contador continua recuperável por reconciliação se
  o evento Realtime for perdido, mas sons não são reproduzidos retroativamente.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-notificacoes-mensagens-navegador.md`.
- Guia de homologação atualizado: seção **Desempenho e atualização do
  workspace** de `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
