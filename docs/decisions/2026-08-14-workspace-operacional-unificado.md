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

## Hierarquia em camadas

A navegação diferencia trabalho frequente de configuração:

- `Visão geral`, `Conversas`, `Agenda`, `Central` e `Campanhas` são destinos primários. Destinos específicos do papel de corretor permanecem nessa primeira camada quando aplicáveis.
- `Gestão` reúne equipe e acessos.
- `Inteligência` reúne Pedro IA, Empreendimentos e Simulador.
- `Administração` reúne Organização, WhatsApp e Auditoria, respeitando as permissões existentes.
- os três grupos secundários ficam recolhidos por padrão e se abrem automaticamente quando uma de suas rotas está ativa. No celular, a mesma separação aparece dentro de `Mais`.

A Visão geral segue a sequência `resultado → diagnóstico → exceção → ação`:

- o período padrão é de sete dias e afeta apenas as métricas de fluxo;
- Leads, Taxa de resposta, Agendamentos e Vendas formam uma faixa única de resultados; conversão aparece como contexto de Vendas;
- o Kanban é identificado como estoque atual, independente do período, e mostra a contagem de todas as etapas sem exigir rolagem horizontal; cada etapa pode exibir apenas um registro representativo antes do acesso à visão completa;
- pendências de conversa e agenda aparecem depois do resultado e do diagnóstico; estado do Pedro e quantidade de pessoas não ocupam essa camada.

## Compatibilidade

Nenhum contrato de banco, RLS, server action, webhook, URL profunda ou gate de papel é alterado por esta decisão. A consolidação é de arquitetura de informação e interface.

## Substituição

Esta decisão substitui qualquer proposta de navegação que exponha Leads ou Kanban como módulos principais independentes e qualquer proposta de campanha com um editor de personalidade do Pedro.
