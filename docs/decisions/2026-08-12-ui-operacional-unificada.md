# Interface operacional unificada e Signal Workspace

- Data da decisão: 12/08/2026
- Registro: reunião de avaliação técnica às 17:38 BRT
- Status: decisão confirmada pelo usuário em 13/08/2026

## Problema observado

A interface expunha conceitos de infraestrutura, distribuía o mesmo trabalho entre muitas rotas e usava hierarquia visual fraca para um usuário não técnico. A primeira repaginação `Ink, Paper, Signal` reduziu parte do ruído, mas manteve uma estética quente, textos pequenos e excesso de cartões que não atendiam à direção aprovada na reunião.

## Decisão

O produto passa a usar uma arquitetura operacional unificada:

1. Conversas e oportunidades são a fonte de verdade do atendimento. Lista, Kanban, contexto do lead e agenda são visualizações do mesmo trabalho, não módulos concorrentes.
2. A Visão Geral prioriza atenção imediata, atividade recente e indicadores comerciais. Os relatórios deixam de competir como área isolada e passam a integrar essa tela.
3. A Central reúne decisões e registros de Pedro, Lionel, campanhas, integrações, sistema e equipe. A listagem mostra 10 registros por página, dos mais recentes para os mais antigos.
4. A auditoria continua separada por ser uma trilha administrativa e mostra 30 eventos por página.
5. Aprendizados, Experimentos A/B, formulários/pré-leads Meta, checklists comerciais e Privacidade deixam de ser superfícies operacionais. As rotas antigas redirecionam para o contexto canônico; actions, schema e histórico não são apagados por esta mudança de UI.
6. A tela de equipe comunica apenas dois modelos principais: `Corretor` e `Imobiliária`. Papéis internos de dono e gestor continuam existindo para autorização, auditoria e transferência de propriedade, mas são tratados como responsabilidades da imobiliária, não como novos modelos de produto.
7. A configuração do Pedro mantém contextos visivelmente separados para atendimento inbound e reativação de base. As regras de autonomia continuam definidas pelas decisões comportamentais posteriores.

## Direção visual

A linguagem `Signal Workspace` substitui a direção quente anterior:

- canvas azul-neblina, superfícies brancas, texto azul-marinho e cobalto como cor interativa principal;
- Geist e Geist Mono, sem tipografia editorial serifada;
- texto operacional de 11–14 px, evitando rótulos de 8–10 px;
- listas contínuas, bordas discretas e raios menores, com cartões somente quando existe agrupamento real;
- estados semânticos de sucesso, alerta e erro preservados;
- shell de 232 px no desktop e navegação fixa de cinco destinos no mobile;
- animações limitadas a feedback funcional e compatibilidade com `prefers-reduced-motion`.

## Compatibilidade e limites

- Nenhuma migration ou alteração de dados é necessária.
- URLs profundas de Conversas, Kanban, leads e agenda continuam válidas.
- A remoção de uma superfície não autoriza remover dados, políticas de retenção, auditoria ou APIs existentes.
- Esta decisão substitui a direção visual `Ink, Paper, Signal` onde houver conflito, mas não substitui decisões de segurança, RLS, comportamento do Pedro ou operação de campanhas.

## Homologação

Validar desktop e mobile, navegação por papel, ausência de overflow horizontal, fila de atenção, troca Lista/Kanban, contexto do lead, Central com Pedro/Lionel, paginação de 10, auditoria com paginação de 30 e redirecionamento das superfícies retiradas.
