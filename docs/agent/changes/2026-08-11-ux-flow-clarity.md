# Primeira rodada de clareza dos fluxos operacionais

- Data: 11/08/2026
- Responsável: Codex
- Branch/PR: `agent/ux-flow-clarity`
- Commit: o commit que contém este arquivo

## Objetivo

Reduzir a dependência de conhecimento técnico nos primeiros fluxos usados por um dono ou gestor que não desenvolveu o sistema, sem alterar regras de produto, permissões, automações ou contratos de dados.

## Antes e depois

- Antes: o dashboard não indicava uma sequência inicial; Inbox misturava aprovação, ensino, envio humano e controle da conversa; Pedro exibia modos e configurações com nomes técnicos; CRM e agenda não explicavam o próximo passo.
- Depois: o dashboard apresenta cinco primeiros passos; a Inbox explica o que será ou não enviado e usa ações mais diretas; Pedro mostra o comportamento atual em linguagem operacional e separa atendimento normal de conversas antigas; CRM e agenda apresentam instruções e estados mais compreensíveis.

## Escopo executado

- Arquivos: dashboard, detalhe do Inbox, Pedro, lista e detalhe de leads, agenda, estilos correspondentes e este registro; o guia de homologação foi atualizado com os novos rótulos.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados:
  - `npm run lint -- --no-warn-ignored`
  - `npx eslint src/app/app/page.tsx src/app/app/inbox/[id]/page.tsx src/app/app/pedro/page.tsx src/app/app/leads/page.tsx src/app/app/leads/[id]/page.tsx src/app/app/agenda/page.tsx`
  - `npm test`
  - `npm run build` com as variáveis públicas do Supabase carregadas apenas no processo a partir do `.env.local` canônico.
- Evidência observada: lint completo e lint direcionado concluídos sem erros; 21 arquivos de teste e 108 testes passaram; build Turbopack compilou, concluiu TypeScript, gerou 46 rotas e finalizou a otimização.
- Validações não executadas e motivo: validação visual/manual ainda depende de uma pessoa usando a interface; o protocolo do projeto não considera a inspeção automatizada anterior como aceite visual. `npx tsc --noEmit` isolado continua apontando dois erros preexistentes em `src/lib/ai/pedro-turn.test.ts`, não relacionados a esta mudança.

## Impacto operacional

- Deploy necessário: sim para disponibilizar os textos e componentes, mas nenhum deploy foi executado.
- Migração aplicada: não.
- Compatibilidade/rollback: somente apresentação e textos foram alterados; reverter o commit remove a rodada sem alterar dados ou regras de execução.

## Pendências e riscos

- Homologar visualmente em desktop e notebook com pouca altura, principalmente a nova sequência do dashboard, a guia de sugestões da Inbox e a leitura dos modos do Pedro.
- Validar com usuários não técnicos se os rótulos `Enviar resposta`, `Gerar outra resposta`, `Descartar` e `Enviar resposta humana` correspondem ao entendimento esperado.
- A etapa seguinte pode tratar campanhas, equipe/acessos e ações destrutivas com confirmações mais explícitas.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: `docs/operations/GUIA_COMPLETO_DE_HOMOLOGACAO.md`.
