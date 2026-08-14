# Clareza operacional no Chat com Pedro e no Lionel

- Data: 11/08/2026
- Responsável: Codex
- Branch/PR: `agent/chat-pedro-lionel-ux`
- Commit: o commit que contém este arquivo

## Objetivo

Reduzir a ambiguidade na triagem e na decisão do Chat com Pedro e do Lionel
para usuários que não desenvolveram o sistema, preservando as features
assistidas já integradas e sem alterar o contrato de envio ou de aprendizado.

## Antes e depois

- Antes: a fila mostrava apenas título, status e um alerta; Pedro e Lionel
  compartilhavam o rótulo genérico de conversa interna; a tela não explicava o
  próximo passo nem oferecia busca ou filtros.
- Depois: a fila identifica o papel de cada assistente, mostra tipo/origem e
  contagem de pendências, permite buscar e filtrar tópicos, e o painel central
  explica a decisão humana esperada. Lionel também passa a respeitar a mesma
  permissão de gestor usada pela action.

## Escopo executado

- Arquivos: páginas do Chat com Pedro e Lionel, workspace compartilhado, estilos,
  loader da fila, guia de homologação e este registro.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados:
  - `npm run lint -- --no-warn-ignored`
  - `npm test`
  - `npm run build` com as variáveis públicas do Supabase carregadas somente no
    processo a partir do `.env.local` canônico.
- Evidência observada: lint passou; 22 arquivos e 110 testes passaram; build
  compilou, concluiu TypeScript, gerou 46 rotas e finalizou a otimização.
- Validações não executadas e motivo: validação visual e autenticada manual
  continua pendente conforme o protocolo do projeto.

## Impacto operacional

- Deploy necessário: sim para disponibilizar a nova interface; não executado
  nesta branch.
- Migração aplicada: não.
- Compatibilidade/rollback: mudança reversível de código e apresentação; não
  altera dados, envio ao WhatsApp, ações assistidas ou ativação de aprendizado.

## Pendências e riscos

- Validar com usuário não técnico se os textos do painel **Próximo passo** e os
  filtros são compreensíveis em desktop e mobile.
- Confirmar no ambiente autenticado que o filtro de pendências e a busca por
  título preservam a seleção do tópico e o isolamento da operação.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
