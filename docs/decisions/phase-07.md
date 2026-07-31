# Fase 7 — campanhas e follow-ups

## Escopo entregue

- campanha de reativação com conexão ativa, modo do Pedro e declaração explícita de consentimento;
- importação CSV de até 500 linhas, mapeamento `nome/telefone`, staging, erros e deduplicação;
- criação atômica de contato/oportunidade somente para linhas válidas;
- revisão e aprovação separadas da criação;
- ondas explícitas: até 20, depois 50, depois o restante;
- revalidação de opt-out/supressão no instante da liberação;
- um job durável e idempotente por contato liberado;
- pausa, retomada, cancelamento, versão otimista e auditoria;
- opt-out cancela automações pendentes na mesma transação;
- plano padrão publicado com 5 tentativas em 24 horas e 20 em 180 dias.

## Gate da fase

- CSV de gate produziu dois válidos e uma duplicidade;
- opt-out aplicado antes da onda suprimiu o contato;
- primeira onda deixou exatamente um contato em fila e um job pendente;
- campanha sem conexão ativa, consentimento, revisão ou contatos não é aprovada;
- primeira onda acima de 20 e segunda acima de 50 são rejeitadas;
- lint, testes e build passaram com 20 rotas.

## Dependência externa

O dispatcher está pronto, mas o envio real requer URL/token/número de uma conexão Uazapi ou Meta ativa. Sem isso, nenhuma mensagem externa é produzida.
