# Ordenação do Inbox por atenção e atividade

- Data: 10/08/2026
- Status: substituída em 19/08/2026 por `2026-08-19-inbox-chronological-order.md`

## Decisão

O Inbox deve colocar no topo as conversas que exigem atenção operacional:

- pelo menos uma mensagem inbound não lida pelo usuário atual; ou
- pelo menos uma sugestão da IA com status `pending`.

As duas situações pertencem ao mesmo grupo de atenção. Dentro do grupo de
atenção e do grupo regular, a conversa com atividade mais recente aparece
primeiro, usando `conversations.updated_at` como o timestamp já adotado pela
lista. O ID da conversa desempata timestamps iguais de forma determinística.

## Limite da lista

O Inbox continua exibindo no máximo 100 conversas. A consulta busca os 100
itens recentes e, separadamente, recupera as conversas com pendência que
ficaram fora dessa janela antes de aplicar a ordenação final. Assim, uma
conversa antiga que exige ação não desaparece apenas por estar fora dos 100
itens mais recentes.

## Limites

- A regra não altera o contador, a definição de não lida ou o ciclo de revisão
  da sugestão.
- Abrir a conversa atualiza o cursor de leitura do usuário; aprovar, ensinar ou
  descartar resolve a sugestão conforme o fluxo existente.
- Não há migration nem mudança de RLS: a fonte continua sendo
  `inbox_notification_counts`.
