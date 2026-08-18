# Correção da transcrição de áudio Uazapi

- Data: 18/08/2026
- Responsável: Codex
- Branch/PR: `fix/uazapi-audio-transcription`, PR #54
- Commit: o commit que contém este arquivo

## Objetivo

Restaurar o recebimento, download autenticado e transcrição dos áudios inbound
da Uazapi e conter a cadência criada pelo incidente observado.

## Antes e depois

- Antes: o payload real guardava MIME e localizador criptografado em
  `message.content`, campo que o normalizador não lia. Nenhuma
  `message_media_source`, attachment ou transcrição era criada; após a
  recuperação automática, o Pedro recebia uma string vazia e podia repetir a
  pergunta anterior.
- Depois: áudios e demais mídias reconhecidas usam o ID da própria mensagem
  como localizador autenticado, resolvem a mídia por `POST /message/download`,
  baixam somente de origem HTTPS autorizada e seguem a fila existente de
  Storage/transcrição.

## Escopo executado

- Arquivos: adapter e testes de integrações WhatsApp e este registro.
- Migrations: nenhuma; tabelas, RPCs, fila de mídia e bucket privado existentes
  já suportam o fluxo corrigido.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: no Supabase
  remoto canônico, 25 jobs `followup.ai_turn` ainda pendentes da segunda
  execução afetada foram alterados para `cancelled`, com o motivo redigido
  `cancelled_after_unprocessed_audio`. O filtro usou conversa, tipo, status e
  prefixo de deduplicação da execução exatos. A Uazapi foi consultada de forma
  autenticada e somente leitura para validar o contrato real de download; não
  houve envio de mensagem nem alteração no fornecedor. O PR #54 foi mergeado
  por squash na branch padrão no commit
  `f96275b2b2e41a3e39f71c3c8bcc9cd382d8848e`. O Git Integration publicou o
  deployment Vercel `dpl_HbFe8AKw4hUW187HVs3vDisg8ieb`, que ficou `READY` em
  produção e recebeu o alias `https://gril-lac.vercel.app`.

## Validação

- Comandos/testes executados: inspeções no Supabase remoto; chamada autenticada
  de leitura à Uazapi; teste direcionado do adapter; suíte Vitest completa;
  ESLint direcionado e completo; build de produção; `git diff --check`.
- Evidência observada: os dois áudios do incidente tinham zero fonte de mídia,
  zero attachment e zero transcrição. O endpoint real devolveu um MP3 por
  `fileURL`; após a contenção, o lote afetado ficou com zero job pendente e 25
  cancelados. A suíte automatizada passou com 23 arquivos e 115 testes; o lint
  completo passou; o build concluiu TypeScript e gerou 46 rotas. Após o deploy,
  `/login` e a raiz pública responderam HTTP 200; a raiz terminou em `/login`,
  como esperado para sessão anônima. O scan de logs de erro do deployment não
  retornou ocorrências.
- Validações não executadas e motivo: a homologação ponta a ponta com um novo
  áudio real permanece pendente para não gerar nova interação com o lead sem
  coordenação humana.

## Impacto operacional

- Deploy necessário: concluído no deployment
  `dpl_HbFe8AKw4hUW187HVs3vDisg8ieb`, a partir do commit canônico `f96275b`.
- Migração aplicada: não.
- Compatibilidade/rollback: o caminho antigo por `sourceUrl` continua como
  fallback para payloads compatíveis. O rollback do código restaura o adapter
  anterior; o cancelamento dos 25 jobs não será revertido, pois eles derivavam
  de uma resposta sem transcrição.

## Pendências e riscos

- Reprocessar os áudios históricos somente com revisão humana, evitando novo
  efeito conversacional automático antes de revisar o resultado.
- Homologar um novo áudio real e confirmar transcrição, anexo privado e
  sugestão assistida antes de considerar o incidente encerrado.
- Consolidar este estado em `docs/agent/CURRENT_STATE.md` depois da integração
  do PR #52, que já altera o mesmo arquivo; ele foi deliberadamente excluído
  deste PR para não sobrepor trabalho concorrente.

## Por que apareceram 25 follow-ups

A resposta incorreta escolheu a estratégia `short`. O mecanismo vigente
programou simultaneamente as cinco retomadas curtas das primeiras 24 horas e a
continuação curta-para-longa com vinte retomadas distribuídas por até seis
meses. Portanto, `5 + 20 = 25`. O primeiro lote já havia sido cancelado pela
segunda mensagem inbound; o segundo lote foi o conjunto neutralizado nesta
correção.

## Documentos relacionados

- Decisões atualizadas: nenhuma; a regra já existia na especificação de produto.
- Guia de homologação atualizado: não. O guia já determina que Pedro recebe e
  transcreve áudio quando suportado; a adição de um roteiro mais detalhado foi
  evitada porque worktrees concorrentes alteram o mesmo arquivo.
