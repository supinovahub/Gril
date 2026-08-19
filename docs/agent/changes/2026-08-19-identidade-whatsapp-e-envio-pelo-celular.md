# Identidade WhatsApp e mensagens enviadas pelo celular

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/contact-identity-outbound-sync` / a abrir
- Commit: o commit que contém este arquivo

## Objetivo

Evitar contatos e conversas duplicados quando a Uazapi devolve um celular
brasileiro sem o nono dígito e restaurar a ingestão das mensagens enviadas
manualmente pelo celular conectado.

## Antes e depois

- Antes: a resposta à campanha podia ser tratada como outro E.164, criando
  contato, oportunidade e conversa separados. Mensagens manuais do aparelho
  eram abortadas porque o gatilho de feedback lia uma coluna removida de
  `escalations`.
- Depois: celulares brasileiros legados são canonicalizados antes da comparação
  e persistência; pares técnicos inequívocos são consolidados na conversa da
  campanha; o gatilho usa `source_execution_id` e a mensagem manual volta a ser
  persistida com a intervenção humana prevista.

## Escopo executado

- Arquivos: normalizador e testes de telefone/Uazapi, migration, teste pgTAP,
  decisão de produto, guia de homologação e este registro.
- Migrations:
  `20260819165442_fix_whatsapp_identity_and_device_outbound.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: consultas de
  diagnóstico somente leitura na Uazapi; um replay idempotente confirmou o erro
  `external_outbound_ingest_rejected` sem persistir mensagem. Aplicação e deploy
  permanecem pendentes neste registro de implementação.

## Validação

- Comandos/testes executados: testes direcionados (32), suíte Vitest completa
  (27 arquivos/130 testes), ESLint, build Next.js 16.2.12 das 46 páginas,
  `supabase db push --linked --dry-run`, `supabase db lint --linked --fail-on
  error` e `git diff --check`.
- Evidência observada: três pares apresentavam exatamente uma conversa de
  campanha no telefone canônico e outra conversa inbound no formato legado; os
  webhooks das mensagens manuais chegavam ao app e falhavam com PostgreSQL
  `42703` ao acessar `new.execution_id`. O dry-run selecionou somente a migration
  desta correção e o lint não apontou erros.
- Validações não executadas e motivo: o pgTAP local não rodou porque este host
  não dispõe de Docker/Podman. A migration ainda será validada e aplicada de
  forma serializada no banco remoto durante a publicação autorizada.

## Impacto operacional

- Deploy necessário: sim, junto das notificações de novas mensagens.
- Migração aplicada: não neste registro.
- Compatibilidade/rollback: o valor original do telefone é preservado; fixos e
  números internacionais não mudam. O rollback de código não deve desfazer a
  consolidação auditada; eventual reversão do gatilho deve ser feita por nova
  migration forward-only.

## Pendências e riscos

- Integrar a branch canônica, aplicar a migration serializada, reconciliar as
  mensagens manuais ausentes e confirmar o deployment de produção.
- Homologar uma nova resposta controlada de campanha e um envio pelo celular.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-19-canonicalizacao-celular-brasileiro-whatsapp.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
