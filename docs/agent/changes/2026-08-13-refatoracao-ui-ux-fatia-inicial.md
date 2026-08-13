# Refatoração UI/UX — fatia inicial

- Data: 13/08/2026
- Responsável: Codex
- Branch/PR: `agent/ui-architecture-audit`
- Commit: o commit que contém este arquivo

## Objetivo

Executar a primeira fatia da auditoria UI/UX e reduzir a exposição da estrutura
interna do backend na experiência principal do corretor/imobiliária, preservando
APIs, actions, regras de negócio e rotas legadas.

## Antes e depois

- Antes: Inbox, Leads, Pipeline e áreas operacionais apareciam como destinos
  principais separados; o dashboard priorizava sinais técnicos; campanhas e IA
  expunham configurações extensas; o Inbox carregava a lista principal pela
  rota legada.
- Depois: Conversas é a entrada canônica com views de trabalho; Inbox permanece
  como alias; o dashboard prioriza atenção, operação e conversão; Central de
  operações e Auditoria receberam leitura mais uniforme; campanhas seguem um
  wizard de cinco etapas; IA separa Atendimento e Reativação; Relatórios saiu
  da navegação primária e Equipe passou a comunicar os modelos Corretor e
  Imobiliária antes dos controles administrativos.

## Escopo executado

- Arquivos: primitives compartilhadas de UI, App Shell, Dashboard,
  Conversas, alias do Inbox, Central de operações, Auditoria, Campanhas,
  Pedro/IA, Equipe e App Shell.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: nenhuma.

## Validação

- Comandos/testes executados: `npm run lint`, `npm test`, `npm run build`,
  `git diff --check`.
- Evidência observada: lint aprovado; 22 arquivos de teste e 110 testes
  aprovados; build com variáveis locais carregadas aprovado com 47 rotas; o
  endpoint local `/login` respondeu HTTP 200.
- Validações não executadas e motivo: o CLI `agent-browser` não está instalado
  neste host, portanto não foi possível executar o smoke visual automatizado.
  Também não foi feita homologação autenticada nesta branch.

## Impacto operacional

- Deploy necessário: sim, caso esta branch seja promovida; nenhum deploy foi
  feito durante a tarefa.
- Migração aplicada: não.
- Compatibilidade/rollback: actions, consultas existentes, APIs e detalhe de
  conversa foram preservados; `/app/inbox` redireciona para `/app/conversas`.
  O rollback é a reversão dos commits desta branch.

## Pendências e riscos

- A consulta de notificações do Inbox e os filtros da Auditoria ainda dependem
  das views/RPC existentes; a etapa seguinte deve medir e mover paginação e
  filtros para o banco sem alterar o contrato funcional.
- Leads e Agenda ainda possuem rotas próprias; a consolidação total em
  Conversas exige uma decisão de migração de navegação e homologação dos fluxos.
- O restante da simplificação de Equipe, a integração profunda de Relatórios
  no overview e a remoção física de módulos legados permanecem para fatias
  posteriores.
- A nova UI precisa de smoke test autenticado antes de publicação.

## Documentos relacionados

- Decisões atualizadas: nenhuma; esta fatia não alterou regra de negócio.
- Guia de homologação atualizado: não; os fluxos existentes continuam
  acessíveis e a homologação visual deve ser acrescentada quando a navegação
  consolidada for promovida.
