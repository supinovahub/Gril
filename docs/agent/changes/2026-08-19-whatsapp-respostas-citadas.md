# Contexto de mensagens citadas no WhatsApp

- Data: 19/08/2026
- Responsável: Codex
- Branch/PR: `fix/whatsapp-quoted-replies`
- Commit: o commit que contém este arquivo

## Objetivo

Fazer o Pedro interpretar respostas do WhatsApp que citam uma mensagem antiga,
preservando a referência enviada pelo provedor e entregando o conteúdo citado
ao modelo sem inferências soltas.

## Antes e depois

- Antes: a Uazapi enviava o identificador da mensagem citada em
  `message.quoted`, mas o adapter não o normalizava, o vínculo
  `messages.reply_to_message_id` permanecia vazio e o worker entregava somente
  o texto curto atual ao Pedro.
- Depois: Uazapi e Meta normalizam o identificador citado; a ingestão o resolve
  atomicamente dentro da mesma organização e conversa; o worker identifica o
  autor e o conteúdo citado, inclusive fora da janela recente. Referências não
  resolvidas continuam usando o esclarecimento curto já previsto para
  ambiguidade.

## Escopo executado

- Arquivos: adapter e rota de webhook, contexto do worker, tipos do banco,
  testes TypeScript, teste pgTAP, guia de homologação, rastreabilidade do Pedro
  e este registro.
- Migrations: `20260819150905_preserve_whatsapp_quoted_replies.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: pendentes até
  a integração e publicação desta branch; nenhuma mensagem será enviada para
  validar a correção.

## Validação

- Comandos/testes executados: ESLint direcionado e completo; 26 arquivos/123
  testes Vitest; build Next.js 16.2.12 das 46 rotas; `git diff --check`;
  `supabase db push --linked --dry-run`; pgTAP da fase 48 e aplicação integral
  da migration em transação remota revertida.
- Evidência observada: no caso reportado, o payload vivo continha o ID citado e
  a mensagem alvo existia na mesma conversa, enquanto o vínculo canônico estava
  vazio e a execução da IA recebeu apenas a resposta curta. No ensaio remoto, o
  backfill resolveu exatamente esse vínculo; o teste cobriu idempotência e
  bloqueio entre conversas; o rollback posterior deixou a coluna ausente e o
  registro real inalterado.
- Validações não executadas e motivo: homologação real por WhatsApp ficará para
  o usuário, evitando nova interação não coordenada com um lead.

## Impacto operacional

- Deploy necessário: sim, para o adapter, a rota e o worker.
- Migração aplicada: ainda não.
- Compatibilidade/rollback: a coluna é opcional; código anterior continua
  inserindo webhooks. O rollback de código mantém os vínculos já criados. Uma
  reversão de schema pode remover apenas o trigger, a função e a coluna nova;
  os `reply_to_message_id` corretos podem permanecer sem afetar clientes antigos.

## Pendências e riscos

- Confirmar tecnicamente a migration no banco remoto e o deploy na Vercel.
- Homologar manualmente uma nova resposta citada em número autorizado.
- Ordem de integração: esta correção entra antes do PR rascunho `#66`, que
  também altera o worker em outra região. O PR `#66` deverá atualizar sua base
  depois deste merge; nenhum trecho dele foi incorporado ou alterado aqui.

## Documentos relacionados

- Decisões atualizadas: nenhuma; `reply_to_message_id` já faz parte do modelo
  aprovado e a política vigente já exige esclarecimento em caso de ambiguidade.
- Guia de homologação atualizado:
  `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- Rastreabilidade atualizada:
  `docs/operations/PEDRO_BEHAVIOR_TRACEABILITY.md`.
