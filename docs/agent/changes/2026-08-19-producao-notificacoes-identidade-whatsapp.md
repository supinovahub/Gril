# Publicação das notificações e da identidade WhatsApp

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: implementação em `fix/contact-identity-outbound-sync`, PR #76;
  registro em `docs/record-whatsapp-notifications-production`
- Commit: o commit que contém este arquivo; implementação integrada por
  `1da7a5c26d4e92b957b1500acc448a20c8d7afc6`

## Objetivo

Publicar notificações de novas mensagens no navegador, eliminar duplicidades
causadas pela variação brasileira com e sem nono dígito e restaurar mensagens
enviadas manualmente pelo aparelho que não apareciam no dashboard.

## Antes e depois

- Antes: o workspace não tocava som nem informava o total no título da aba; uma
  resposta de campanha podia criar outro contato quando a Uazapi devolvia o
  celular no formato legado; mensagens manuais eram abortadas por um gatilho que
  ainda lia `new.execution_id` de `escalations`.
- Depois: novas mensagens inbound geram aviso sonoro e contador na aba, com
  controle persistente de áudio; celulares brasileiros móveis são
  canonicalizados antes do ingest; pares inequívocos são consolidados na
  conversa da campanha; o gatilho usa `source_execution_id` e outbounds do
  aparelho voltam a ser persistidos como intervenção humana.

## Escopo executado

- Arquivos: componentes, política e testes de notificação; normalizador e testes
  de telefone/Uazapi; migration, pgTAP, decisões, guia de homologação e registros
  de implementação.
- Migrations:
  `20260819165442_fix_whatsapp_identity_and_device_outbound.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: PR #76 mergeado;
  migration aplicada no projeto `frslhzwhaooqtivkzdez`; três pares técnicos
  consolidados; quatro mensagens manuais ausentes da conversa reportada de Uira
  reprocessadas idempotentemente; deployment Vercel
  `dpl_HPC8qc1uhStjCKXkvaC8sMXcmrLh` publicado em produção. A consulta à Uazapi
  usada na reconciliação foi somente leitura.

## Validação

- `npm run lint`: aprovado.
- `npm test`: 27 arquivos e 130 testes aprovados.
- `npm run build`: aprovado no Next.js 16.2.12 com 46 rotas.
- Testes direcionados: 32 casos aprovados; `git diff --check` aprovado; checks do
  PR e preview Vercel aprovados.
- `supabase db push --linked --dry-run`: selecionou somente a migration
  `20260819165442`; a aplicação serializada concluiu com sucesso e a listagem
  remota confirma essa versão como a mais recente.
- Verificação pós-migration: zero grupos duplicados, zero celulares legados
  ativos no escopo, três eventos de reparação auditados e quatro outbounds
  restaurados na mesma conversa. O gatilho de canonicalização está ativo e a
  função de feedback referencia `source_execution_id`.
- `npx supabase db lint --linked --fail-on error`: aprovado sem erros; somente
  avisos históricos. Os advisors continuam registrando achados gerais da tabela
  preexistente `webhook_ingest_requests`: [RLS sem política para acesso direto](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  e [chaves estrangeiras sem índice dedicado](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
  A tabela permanece inacessível diretamente pela API, e nenhum achado cita a
  nova função privada ou os novos gatilhos.
- Vercel: identidade `suporteinovahub-7501` confirmada pelo perfil isolado;
  deployment `dpl_HPC8qc1uhStjCKXkvaC8sMXcmrLh` inspecionado como `READY`, alvo
  `production` e alias `https://gril-lac.vercel.app`.
- Smoke público: `/login` retornou 200 e `/app/inbox` retornou 307 para
  `/login?next=%2Fapp%2Finbox`; a consulta desde a publicação não encontrou logs
  de nível `error` no deployment.
- Validações não executadas: o pgTAP local não rodou porque este host não possui
  Docker/Podman. Som, contador e comportamento entre duas abas exigem uma sessão
  autenticada no Chrome e uma nova mensagem controlada.

## Impacto operacional

- Deploy necessário: concluído em `https://gril-lac.vercel.app`.
- Migração aplicada: sim, `20260819165442` no projeto
  `frslhzwhaooqtivkzdez`.
- Compatibilidade/rollback: o telefone original permanece no payload de
  auditoria; fixos e números internacionais não mudam. A consolidação de dados
  não deve ser desfeita. Rollback de aplicação exige promover um bundle anterior
  e qualquer reversão de schema deve ser uma nova migration forward-only.

## Pendências e riscos

- Homologar em Chrome, após uma interação com a página, uma nova mensagem inbound
  com duas abas abertas, conferindo um único som, contador no título, atualização
  sem F5 e controle de silenciar.
- Homologar uma nova resposta controlada de campanha no formato alternativo do
  celular e um novo envio manual pelo aparelho.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-notificacoes-mensagens-navegador.md` e
  `docs/decisions/2026-08-19-canonicalizacao-celular-brasileiro-whatsapp.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
