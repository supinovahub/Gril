# Rotas do produto

## Rotas primárias autenticadas

| Rota | Tela atual | Observação de produto |
|---|---|---|
| `/app` | Visão geral | Dashboard de dono/gestor; primeiro alvo do redesenho. |
| `/app/hoje` | Hoje | Página inicial operacional do corretor. |
| `/app/inbox` | Inbox | Conversas priorizadas por atenção. |
| `/app/inbox/[id]` | Conversa | Histórico e ações da conversa. |
| `/app/leads` | Leads | Cadastro e CRM atual. |
| `/app/agenda` | Agenda | Calls e disponibilidade. |
| `/app/central` | Central | Registros e alertas operacionais. |
| `/app/kanban` | Pipeline | Visão geral gerencial do funil. |
| `/app/meu-pipeline` | Meu pipeline | Recorte do corretor. |
| `/app/campanhas` | Campanhas | Reativação e disparos. |
| `/app/equipe` | Equipe e acessos | Gestão de membros e convites. |
| `/app/pedro` | Pedro IA | Configuração e estado do agente. |
| `/app/chat-pedro` | Chat com Pedro | Fila assistida para dono/gestor. |
| `/app/lionel` | Lionel | Curadoria interna. |
| `/app/conhecimento` | Empreendimentos | Base factual do agente. |
| `/app/simulador` | Simulador | Teste de conversas sem efeitos reais. |
| `/app/relatorios` | Relatórios | Métricas atuais a integrar à visão geral. |
| `/app/configuracoes/auditoria` | Auditoria | Logs; decisão vigente exige 30 itens por página. |

## Rotas que a decisão de 12/08 retira da navegação

Os arquivos podem permanecer por compatibilidade, mas Aprendizados, Experimentos A/B, formulário pré-lead Meta, Checklists comerciais e Privacidade não devem continuar como destinos promovidos na interface.

## Regra desta vertical

O primeiro ciclo redesenha apenas `/app` no canvas. Nenhuma URL, server action, query param, gate de permissão ou rota profunda será alterada antes da aprovação visual e de uma decisão específica para a consolidação de navegação.
