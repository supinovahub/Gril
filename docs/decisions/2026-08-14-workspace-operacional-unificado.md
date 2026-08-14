# Workspace operacional unificado

- Data: 14/08/2026
- Status: aprovado para homologação
- Origem: revisão de produto de 12/08/2026 e aprovação direta do responsável pelo produto

## Decisão

A aplicação passa a organizar o trabalho pela tarefa do usuário, sem repetir a mesma entidade em várias entradas da navegação:

- `Conversas` é a entrada única para Inbox e Leads. A própria tela oferece as visualizações `Conversas` e `Leads`; as rotas existentes continuam preservadas para compatibilidade e links profundos.
- Kanban não aparece na navegação principal. A Visão geral mostra o resumo comercial e o botão `Abrir Kanban completo` é o único acesso de navegação geral à rota completa.
- `Central` reúne em ordem cronológica os registros de Pedro, Lionel, alertas, notificações, calls, campanhas e integrações, com dez registros por página.
- Auditoria permanece acessível conforme as permissões existentes e mostra trinta eventos por página.
- Campanhas mantém configuração de modo e os gates operacionais do Pedro, mas não apresenta edição de personalidade ou persona.
- Aprendizados, Experimentos A/B, formulário pré-lead Meta, Checklists comerciais, Privacidade e Relatórios deixam de ser destinos da navegação. Suas rotas não são removidas neste ciclo.

## Identidade visual

A estrutura e a hierarquia podem mudar, mas paleta, favicon, título da aba, marca e tipografia de produção permanecem. O redesign usa dados reais e não introduz métricas, pessoas, alertas ou estados fictícios.

## Compatibilidade

Nenhum contrato de banco, RLS, server action, webhook, URL profunda ou gate de papel é alterado por esta decisão. A consolidação é de arquitetura de informação e interface.

## Substituição

Esta decisão substitui qualquer proposta de navegação que exponha Leads ou Kanban como módulos principais independentes e qualquer proposta de campanha com um editor de personalidade do Pedro.
