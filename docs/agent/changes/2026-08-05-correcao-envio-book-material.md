# Correção do envio do book após pedido de informações

- Data: 05/08/2026
- Responsável: Codex na sessão principal do Gril
- Branch/PR: `fix/project-book-delivery`
- Commit: o commit que contém este arquivo

## Objetivo

Corrigir o fluxo em que o Pedro identifica o book correto de um empreendimento, mas não cria a entrega de mídia quando o lead pede naturalmente mais informações sobre o imóvel.

## Antes e depois

- Antes: a frase “pode me enviar mais informações sobre o imóvel?” não era reconhecida pelo detector de intenção porque o verbo `enviar` não fazia parte da guarda que aproveita o `kind: "book"` retornado pela IA. O servidor convertia a intenção para `none`, impedindo a criação da mensagem e do job de envio.
- Depois: `enviar` é tratado como pedido explícito de mídia quando a ação estruturada informa `kind: "book"`; o book segue para o mesmo enfileiramento determinístico das demais mídias aprovadas.

## Escopo executado

- Arquivos: `src/lib/ai/pedro-turn.ts`, `src/lib/ai/pedro-turn.test.ts`, `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md` e este registro.
- Migrations: nenhuma; a correção ocorre antes do RPC existente que enfileira `project_media`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma. Foi feita somente consulta remota de verificação no Supabase.

## Validação

- Comandos/testes executados: `npx vitest run src/lib/ai/pedro-turn.test.ts`; `npm run lint`; `npm test`; `npm run build`; `npx supabase db lint --linked --fail-on error`; `npx supabase db query --linked "select 1 as ok;"`; `git diff --check`.
- Evidência observada: regressão direcionada passou com 9 testes; suíte completa passou com 19 arquivos e 108 testes; lint passou; build Next.js passou com 46 rotas; banco respondeu `ok = 1`; db lint terminou sem erros, mantendo apenas avisos preexistentes.
- Validações não executadas e motivo: não houve deploy nem homologação visual/operacional com WhatsApp real; o protocolo do projeto reserva essa confirmação ao teste humano com telefone autorizado.

## Impacto operacional

- Deploy necessário: sim; publicar o worker/aplicação que executa `src/lib/runtime/worker.ts` para que a correção entre no fluxo real.
- Migração aplicada: não se aplica.
- Compatibilidade/rollback: mudança aditiva no detector de intenção; rollback por reversão dos arquivos alterados, sem impacto de schema ou dados.

## Pendências e riscos

- Publicar a branch pelo fluxo Git/Vercel autorizado e confirmar o deployment `Ready`.
- Repetir com lead de homologação autorizado: após a qualificação, enviar “pode me enviar mais informações sobre o imóvel?” e confirmar que o PDF do empreendimento identificado aparece no WhatsApp e no Inbox como enviado.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a correção implementa a regra existente de enviar somente material aprovado após interesse explícito.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`, seção de Pedro e conhecimento.
