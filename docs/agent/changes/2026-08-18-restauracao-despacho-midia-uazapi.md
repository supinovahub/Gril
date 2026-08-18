# Restauração do despacho de mídia inbound da Uazapi

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `fix/uazapi-media-job-dispatch`
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
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: pendentes de
  registro após aplicação e homologação.

## Validação

- Comandos/testes executados: pendentes.
- Evidência observada: a mensagem de áudio recebida às 12:27 BRT foi
  normalizada com MIME e identificador de mídia, mas seu job terminou `dead`,
  com cinco tentativas e `last_error=unsupported_job_type`.
- Validações não executadas e motivo: pendentes de execução.

## Impacto operacional

- Deploy necessário: migration no Supabase canônico; o worker já implementa o
  processamento de `process_media`, portanto não há alteração de aplicação.
- Migração aplicada: ainda não.
- Compatibilidade/rollback: a migration preserva a função atual sob o nome
  `execute_runtime_job_before_media_dispatch_fix`; rollback pode restaurar esse
  dispatcher e remover somente o wrapper novo.

## Pendências e riscos

- Reenfileirar somente o job morto do novo áudio de homologação depois da
  aplicação e confirmar attachment, transcrição e retomada do fluxo assistido.

## Documentos relacionados

- Decisões atualizadas: nenhuma; trata-se de restauração técnica do fluxo já
  aprovado.
- Guia de homologação atualizado: não; o comportamento esperado já está
  documentado.
