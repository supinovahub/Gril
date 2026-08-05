# Controles contextuais depois da análise do Pedro

## Decisão

Toda mensagem elegível para o Pedro deve chegar primeiro ao modelo com o histórico recente, o resumo cumulativo e o contexto comercial aprovado. Nenhuma palavra isolada pode pausar a conversa, criar handoff ou aplicar uma regra comportamental antes dessa análise.

As regras rígidas continuam obrigatórias, mas passam a limitar ações: envio ou solicitação de dados de pagamento, tratamento de documento realmente sensível, fraude, privacidade, opt-out e demais efeitos críticos. A simples menção a `pagar`, `sinal`, `processo`, `documento`, `IA` ou termos semelhantes não constitui uma intenção por si só.

Quando o contexto sustentar uma escalada, a saída estruturada deve registrar:

- categoria;
- justificativa;
- evidência contextual;
- confiança mínima de `0,8`.

Ambiguidade deve gerar resposta normal ou uma pergunta curta de esclarecimento. Escaladas e seus efeitos são aplicados no backend somente após a conclusão válida da execução da IA e são idempotentes por execução.

As funções legadas de controle lexical permanecem apenas para preservar o histórico das migrations e ficam sem permissão de execução para qualquer role do runtime.

## Compatibilidade com os documentos originais

- Opt-out continua determinístico no efeito: bloqueia automações e cancela jobs depois de ser compreendido contextualmente.
- Dados de pagamento continuam proibidos para a IA; conversar sobre orçamento, entrada, parcela e financiamento continua permitido.
- Arquivos sensíveis continuam fora do modelo. O Pedro recebe o tipo do anexo e o contexto da conversa, não os bytes ou o conteúdo protegido.
- Permissão, ownership, modo, versão, supressão e disponibilidade do conector continuam sendo precondições técnicas anteriores ao envio. Elas não interpretam palavras do lead.

## Substituições explícitas

Esta decisão substitui:

- a interceptação lexical anterior ao modelo registrada na Fase 12;
- a descrição de controles por palavra em `phase-13-to-23.md`;
- a linha equivalente da rastreabilidade comportamental.
