# Dashboard orientado a métricas com snapshot do Kanban

- Data: 14/08/2026
- Status: decisão de produto aprovada pelo usuário

## Decisão

A Visão geral deixa de ser uma exposição da estrutura técnica e passa a abrir
com quatro métricas comerciais: novos leads, taxa de resposta, agendamentos e
conversão. O usuário pode comparar hoje, sete dias e trinta dias.

O funil resumido é substituído por um snapshot do Kanban real. As etapas seguem
a ordem configurada no pipeline, cada coluna informa a quantidade total e mostra
no máximo dois leads recentes. A edição continua no Kanban completo; a Visão
geral é somente leitura.

## Definição das métricas

- Novos leads: oportunidades criadas no período selecionado.
- Taxa de resposta: conversas com entrada no período cuja saída mais recente é
  igual ou posterior à entrada mais recente.
- Agendamentos: calls criadas no período selecionado.
- Conversão: vendas confirmadas no período divididas pelas oportunidades
  criadas no mesmo período.
- Quando uma consulta falhar, ultrapassar o limite seguro de cálculo ou não
  houver denominador, a interface mostra `N/D`; não transforma ausência de base
  em zero.

## Hierarquia complementar

- Remover a saudação, “Bom dia, Pedro” e o rótulo “Hoje na operação”.
- “Precisa de atenção” e “Agenda” permanecem como contexto secundário, com no
  máximo três itens cada.
- O estado do Pedro e a quantidade de pessoas ativas ficam em uma linha discreta.
- A limpeza de contexto `HML-` permanece disponível para usuários autorizados,
  recolhida em “Área administrativa”.

## Limites

- A identidade de produção, a paleta, o favicon, o título do navegador, as rotas,
  as permissões, o RLS e os contratos de banco não mudam.
- Esta decisão não consolida rotas nem transforma o snapshot em um segundo
  Kanban editável.
- Não há migration nem alteração de dados.
