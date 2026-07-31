# Fase 2 — CRM e pipeline

## Escopo entregue

- contato canônico separado da decisão de compra;
- telefone E.164 e deduplicação exata dentro da organização;
- criação manual atômica com atribuição, contexto, nota interna e origem;
- nove etapas fixas do MVP, histórico append-only e versão otimista;
- próxima ação, motivo de perda e registro de venda;
- isolamento por organização, operação e corretor atribuído;
- outbox e auditoria na mesma transação das mudanças críticas;
- lista, detalhe e Kanban operacionais no localhost.

## Decisões inferidas dos sete documentos

1. Uma oportunidade aberta para o mesmo contato e operação é reutilizada. Uma compra futura ou uma venda já encerrada exige nova oportunidade.
2. O fluxo normal avança uma etapa por vez ou vai para `Perdido`. Dono e gestor podem corrigir uma etapa para trás, desde que informem motivo com pelo menos cinco caracteres.
3. `Perdido` pode voltar somente para `Em atendimento`, por dono ou gestor. `Venda concluída` é imutável.
4. O corretor vê e altera somente oportunidades atribuídas a ele e não pode mover um lead de volta às etapas iniciais da IA.
5. `Solicitar Pedro` apenas registra um evento autorizado na outbox nesta fase. O envio real depende do conector e do motor das fases seguintes.
6. Nota interna nunca é fornecida ao modelo. O contexto só é compartilhado com corretor quando a flag explícita estiver ativa.

## Gate da fase

- contato e oportunidade são reutilizados com o mesmo E.164;
- corretor vê somente lead atribuído; outro tenant e vínculo pendente veem zero;
- transição inválida e versão desatualizada são rejeitadas no servidor;
- venda exige mês/ano, perda exige motivo ativo e venda concluída não reabre;
- lint, testes unitários, build e Advisors de segurança executados.

## Fora desta fase

- envio WhatsApp, processamento da outbox e execução do Pedro;
- merge manual reversível de contatos;
- drag-and-drop visual do Kanban. A mudança por formulário já usa o mesmo contrato transacional definitivo.

