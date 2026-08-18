# Remoção de gates operacionais do production inbound

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `agent/relax-inbound-production-gates`, PR #60
- Commit: o commit que contém este arquivo

## Objetivo

Permitir que o dono selecione `production` no inbound sem depender de perfil
institucional completo, health check recente ou regressão aprovada, preservando
a restrição de destinatários pela whitelist.

## Antes e depois

- Antes: a transição era recusada quando qualquer um dos três gates estivesse
  abaixo do limiar, mesmo com whitelist e conexão inbound ativa.
- Depois: esses três sinais permanecem diagnósticos, mas não bloqueiam a
  ativação. Whitelist, conhecimento, modelos e conexão inbound ativa continuam
  obrigatórios.

## Escopo executado

- Arquivos: Server Action e orientação da tela de Pedro, decisão de produto,
  traceabilidade e guia de homologação.
- Migrations: `20260818170835_relax_inbound_production_gates.sql` substitui
  somente o trigger function de prontidão.
- Testes SQL: `supabase/tests/phase_45_relaxed_inbound_production_gates.sql`.
- Mudanças externas: migration aplicada no Supabase canônico; PR #60 e preview
  Vercel publicados. O deploy canônico ainda depende do merge.

## Validação

- `npm test`: 24 arquivos e 117 testes aprovados.
- `npm run lint -- --no-cache`: aprovado sem erros.
- `npm run build`: aprovado com Next.js 16.2.12 e variáveis locais fictícias,
  sem uso de segredos de produção.
- `npx supabase db lint --linked --fail-on error`: sem erros; apenas avisos
  preexistentes e não relacionados.
- `npx supabase db push --linked --dry-run`: selecionou exclusivamente
  `20260818170835_relax_inbound_production_gates.sql`.
- `git diff --check`: aprovado.
- `npx supabase migration list --linked`: local e remoto alinhados até
  `20260818170835` após a aplicação.
- Consulta direta das definições vivas: os três gates removidos estão ausentes;
  conexão inbound ativa, allowlist, conhecimento e modelos permanecem; as três
  defesas de destinatário estão instaladas e o trigger function não é
  executável pelos papéis da API.
- O teste pgTAP foi criado, mas o runner da CLI exigiu Docker até com `--linked`;
  como este host não tem Docker ou Podman, os mesmos invariantes foram validados
  diretamente no PostgreSQL remoto.
- Advisors de segurança e desempenho: nenhum achado relacionado à função
  alterada; os avisos gerais preexistentes permanecem fora deste escopo.
- A seleção autenticada de production e o envio real de WhatsApp permanecem
  para homologação manual do usuário.

## Impacto operacional

- Deploy necessário: sim, migration, aplicação e documentação juntos.
- Migração aplicada: sim, `20260818170835` no projeto
  `frslhzwhaooqtivkzdez`.
- Compatibilidade/rollback: restaurar a versão anterior do trigger function;
  nenhuma linha de configuração, conversa, mensagem ou whitelist é alterada.

## Pendências e riscos

- Publicar a aplicação a partir da branch canônica e confirmar a rota pública.
- Confirmar manualmente a seleção de production e um novo áudio do número
  allowlisted.

## Documentos relacionados

- Decisões atualizadas:
  `docs/decisions/2026-08-18-production-inbound-sem-gates-operacionais.md`.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
