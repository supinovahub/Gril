# Ordenação cronológica das conversas

- Data: 19/08/2026
- Status: decisão de produto solicitada pelo usuário

## Decisão

A lista de Conversas deve seguir o comportamento familiar do WhatsApp: a
conversa com a mensagem real mais recente aparece primeiro. A ordenação e o
horário mostrado no card usam `messages.created_at` da última mensagem,
decrescente, e o ID da conversa como desempate determinístico. Para uma
conversa ainda sem mensagens, usa-se `conversations.started_at`.

`conversations.updated_at` registra alterações de metadados da conversa e não
é relógio de atividade do Inbox. Mudanças de responsável, modo do Pedro,
pausa, status ou outros controles operacionais não alteram a posição nem o
horário mostrado no card.

Mensagens inbound não lidas e sugestões da IA com status `pending` continuam
aparecendo nos badges e contadores, mas não mudam mais a posição da conversa.

## Limite da lista

O Inbox continua exibindo no máximo 100 conversas. O limite é aplicado depois
da ordenação pela última mensagem, portanto corresponde às 100 conversas com
mensagens mais recentes visíveis para o usuário.

## Compatibilidade

- A definição de não lida e o ciclo de revisão das sugestões permanecem iguais.
- Abrir uma conversa continua atualizando o cursor de leitura do usuário.
- Aprovar, ensinar ou descartar continua resolvendo a sugestão pelo fluxo atual.
- Permissões, RLS, escopo por operação e limite da lista não mudam.

## Substituição

Esta decisão substitui integralmente `inbox-attention-order.md`. A prioridade
de pendências na lista deixa de ser regra de produto.
