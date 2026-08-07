# Publicação do Chat com Pedro em produção

- Data: 2026-08-07
- Responsável: Codex
- Branch/PR: `docs/record-chat-pedro-production` / registro posterior ao PR `#36`
- Commit: o commit que contém este arquivo

## Objetivo

Registrar a publicação em produção da mudança do Chat com Pedro que havia sido
omitida na integração anterior.

## Antes e depois

- Antes: o bundle integrado aguardava publicação na branch padrão.
- Depois: o código do Chat com Pedro está publicado em produção junto com as
  migrations já aplicadas no Supabase remoto.

## Escopo executado

- Arquivos: `docs/agent/CURRENT_STATE.md` e este registro.
- Migrations: nenhuma nova migration aplicada nesta etapa.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: o PR `#36`
  foi mergeado no commit `2bc673d`; o Vercel concluiu o deployment
  `2RbxCrjPHvvy6485j7DtMhvQWz9g` para produção.

## Validação

- Comandos/testes executados: consulta do estado do PR e do commit via GitHub;
  verificação do status Vercel no commit; `curl -I -L` para a raiz pública e
  `/app/chat-pedro`.
- Evidência observada: PR mergeado; check Vercel `success`; raiz respondeu
  HTTP 200; `/app/chat-pedro` respondeu HTTP 307 para o login com o parâmetro
  `next` correto.
- Validações não executadas e motivo: não foi feita homologação autenticada
  das ações do Chat; os testes automatizados e o build já haviam passado no
  PR `#36`.

## Impacto operacional

- Deploy necessário: concluído.
- Migração aplicada: as migrations do Chat já constavam aplicadas no Supabase
  remoto antes desta publicação; nenhuma aplicação foi executada nesta etapa.
- Compatibilidade/rollback: rollback pode ser feito pelo deployment anterior
  do Vercel; a rota continua protegida por autenticação.

## Pendências e riscos

- Executar homologação autenticada de uma sugestão pendente, edição/aprovação,
  ensino e descarte no Chat com Pedro.

## Documentos relacionados

- Decisão: `docs/decisions/chat-pedro-assisted-queue.md`.
- Guia de homologação: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
- PR funcional: `https://github.com/supinovahub/Gril/pull/36`.
