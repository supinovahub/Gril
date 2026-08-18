# Restauração do despacho de mídia inbound da Uazapi

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `fix/uazapi-media-job-dispatch`, PR #56
- Commit: o commit que contém este arquivo

## Objetivo

Restaurar o encaminhamento dos jobs `media.inbound.process` ao processador de
mídia para concluir download, armazenamento privado e transcrição dos áudios
inbound já reconhecidos pelo adapter da Uazapi.

## Antes e depois

- Antes: o novo áudio real criava `message_media_sources` e o job de mídia,
  mas o dispatcher remoto devolvia `unsupported_job_type`; o job morreu após
  cinco tentativas, sem attachment nem transcrição.
- Depois: o dispatcher intercepta `media.inbound.process` na borda externa,
  devolve `process_media` ao worker e delega todos os demais jobs à cadeia
  vigente sem substituir os handlers posteriores.

## Escopo executado

- Arquivos: migration de despacho, teste pgTAP e documentação operacional.
- Migrations: `20260818153716_restore_uazapi_media_job_dispatch.sql`.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: o PR #56 foi
  integrado por merge commit em `234b2a1`; a migration foi aplicada no
  Supabase canônico `frslhzwhaooqtivkzdez`. O job morto do áudio de
  homologação foi reenfileirado com filtro exato por ID, tipo, agregado,
  status e erro. Depois da transcrição, a sugestão assistida produzida antes
  da mídia foi marcada como `superseded`; a mesma execução e o job de
  agregação pós-mídia foram reenfileirados de forma atômica para gerar uma
  sugestão nova a partir da transcrição. Nenhuma mensagem foi enviada e
  nenhum follow-up foi criado. O Git Integration publicou o deployment de
  produção `dpl_SoGabqdS6ZmLveTBzVARdZhX5TfR`, `READY`, com o alias
  `https://gril-lac.vercel.app`.

## Validação

- Comandos/testes executados: preflight de concorrência; `supabase migration
  list --linked`; `supabase db push --linked --dry-run --skip-vault`;
  `supabase db lint --linked --level error --fail-on error`; CI completo do
  PR #56; inspeções SQL remotas do dispatcher, permissões, mensagem, mídia,
  execução assistida, sugestão e follow-ups; smoke HTTP e scan de runtime logs
  do deployment Vercel.
- Evidência observada: a mensagem de áudio recebida às 12:27 BRT foi
  normalizada com MIME e identificador de mídia, mas seu job terminou `dead`,
  com cinco tentativas e `last_error=unsupported_job_type`. Após a correção,
  o job concluiu, a transcrição foi persistida, a análise assistida foi refeita
  e gerou uma sugestão nova sem enviar mensagem nem programar follow-up. O CI
  passou com lint, 115 testes e build; `/login` respondeu HTTP 200 e o scan do
  deployment não encontrou logs de erro.
- Validações não executadas e motivo: o pgTAP direcionado foi solicitado com
  `supabase test db --linked`, mas a CLI tentou iniciar Docker local e não o
  executou porque este host não possui Docker Desktop. O contrato equivalente
  foi confirmado diretamente no remoto: o dispatcher contém o ramo de mídia,
  delega à cadeia anterior, bloqueia `authenticated` e permite somente
  `service_role`.

## Impacto operacional

- Deploy necessário: concluído. O worker já implementava `process_media`; a
  migration restaurou o despacho e a integração Git publicou o merge
  canônico na Vercel.
- Migração aplicada: `20260818153716_restore_uazapi_media_job_dispatch.sql`,
  com histórico local/remoto alinhado e dry-run posterior sem pendências.
- Compatibilidade/rollback: a migration preserva a função atual sob o nome
  `execute_runtime_job_before_media_dispatch_fix`; rollback pode restaurar esse
  dispatcher e remover somente o wrapper novo.

## Pendências e riscos

- O áudio de homologação concluiu na primeira tentativa após o
  reenfileiramento: uma fonte de mídia `completed`, um attachment privado,
  transcrição de 28 caracteres persistida no corpo da mensagem, execução
  assistida `completed`, uma nova sugestão `pending` e zero follow-ups ativos.
- A chamada manual ao worker retornou `401` porque o segredo local não
  corresponde ao segredo vigente da Vercel; nenhuma credencial foi alterada.
  O cron oficial ativo (`* * * * *`) processou os jobs normalmente.
- `CURRENT_STATE.md` não foi alterado para não conflitar com o PR #52 e outras
  worktrees ativas que já modificam esse arquivo. O registro independente aqui
  preserva a evidência até a próxima consolidação segura.

## Documentos relacionados

- Decisões atualizadas: nenhuma; trata-se de restauração técnica do fluxo já
  aprovado.
- Guia de homologação atualizado: não; o comportamento esperado já está
  documentado.
