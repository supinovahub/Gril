# Fase 8 — agenda, distribuição e pós-call

## Escopo entregue

- preferência de receber calls, WhatsApp obrigatório e grupo preferencial;
- disponibilidade semanal e exceções pontuais com timezone da operação;
- hold de 20 minutos e bloqueio total de 30 minutos;
- lead time padrão de 1 hora e escalada silenciosa abaixo disso;
- distribuição preferencial simultânea por 30 minutos;
- distribuição comum com três janelas de 5 minutos e broadcast no minuto 15;
- aceite serializado por call e por agenda do corretor;
- exatamente uma atribuição ativa, late accept perde a corrida;
- liberação do inbox 30 minutos antes e lembretes T-60/T-10;
- briefing somente no dashboard após aceite;
- resultado humano: negociação, perdido, no-show, sem resultado ou reagendamento;
- avanço do Kanban apenas após aceite/resultado e checklists pós-call iniciais.

## Gate da fase

- oferta criada apenas para membro ativo com WhatsApp, opt-in e janela compatível;
- corretor enxerga sua própria oferta sem ganhar acesso às demais;
- aceite produziu `assigned`, versão 3, uma atribuição ativa e três jobs;
- oportunidade avançou de `in_service` para `call_scheduled` somente no aceite;
- índice único, lock da call e advisory lock do corretor protegem a corrida;
- lint, testes e build passaram com 21 rotas.

## Escolha de MVP

A agenda é interna; integração com Google/Outlook fica fora desta versão. Mudança de data, formato ou preferência nominal continua exigindo ação humana explícita.
