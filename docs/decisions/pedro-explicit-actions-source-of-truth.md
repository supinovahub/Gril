# Ações explícitas do Pedro como fonte de verdade

## Decisão

Depois de analisar a conversa completa e o contexto aprovado, Pedro decide explicitamente o texto e as ações comerciais do turno. Essa decisão estruturada é a fonte de verdade para recomendação, mídia, qualificação, call, follow-up e escalada.

O backend pode somente:

- validar existência, publicação, permissão, disponibilidade, versão, ownership, opt-out e idempotência;
- executar exatamente as ações aprovadas;
- bloquear toda a execução e pedir uma nova decisão quando alguma ação não puder ser executada exatamente.

O backend não pode selecionar, ampliar, reduzir, substituir, inferir por palavras ou reescrever a decisão. Regras como “até três empreendimentos” orientam o Pedro; não autorizam o executor a completar uma lista.

## Contratos

- `recommended_project_ids` contém a lista exata escolhida pelo Pedro.
- `project_media_requests` contém cada par exato de empreendimento e tipo de mídia.
- Lista vazia significa nenhuma ação.
- Texto editado pelo humano invalida o plano estruturado antigo; a mensagem editada é enviada sem aplicar ações antigas.
- Saída original, plano validado, resultado da validação e hash ficam registrados separadamente.
- Escaladas podem aplicar efeitos rígidos, mas qualquer mensagem ao lead precisa estar explicitamente em `reply`.

## Falha segura

Se projeto, arquivo ou horário deixar de estar disponível, a execução é bloqueada. Não existe fallback semântico nem substituição silenciosa. Uma nova execução do Pedro deve produzir outro plano contextual.

## Substituições

Esta decisão substitui os trechos anteriores que atribuíam ao servidor a seleção determinística de empreendimentos ou a composição de mensagens e materiais depois da decisão do Pedro. Filtros determinísticos continuam válidos apenas como gates técnicos de bloqueio.
