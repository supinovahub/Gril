# Identidade apresentada como assistente do Pedro

## Contexto

A regra original pausava e escalava silenciosamente qualquer pergunta direta sobre a identidade da IA. Na operação observada, isso fez o atendimento parar logo depois de o lead perguntar se estava conversando com uma IA.

## Decisão

Na primeira pergunta em que o lead quiser saber se está falando com IA, robô, bot ou automação, o atendimento deve responder normalmente, de forma curta, natural e descontraída, dizendo apenas que é o assistente do Pedro Sifuentes, corretor imobiliário. Pequenas variações dessa frase são permitidas, desde que não acrescentem explicações técnicas, não afirmem que o atendimento é o próprio Pedro e não neguem ser IA.

Somente quando o lead insistir na mesma pergunta depois dessa apresentação o turno deve usar `outcome=escalate`, categoria `identity_question`, sem nova resposta automática. O histórico completo distingue a primeira pergunta da insistência.

## Impactos

- A primeira pergunta deixa de criar handoff e recebe uma resposta comercial curta.
- A insistência continua pausando a automação para resolução humana.
- A regra vale no inbound, no modo assistido, em produção e no simulador porque é compilada pelo runtime em todos esses caminhos.
- Nenhum schema, efeito determinístico, permissão ou regra de whitelist muda.

## Substituições explícitas

Esta decisão substitui somente, para perguntas diretas sobre a identidade do atendimento:

- o princípio 3.2 da especificação original que impedia qualquer indicação e a regra 7.1 que escalava já na primeira pergunta;
- o resultado anterior do Fluxo 11 em `MVP_VALIDATION_FLOWS.md`;
- a linha anterior de handoff imediato em `PEDRO_BEHAVIOR_TRACEABILITY.md`.

O restante da persona, da biografia aprovada e das regras de escalada permanece inalterado.

## Refinamento posterior

O tom da apresentação em conversas que já têm rapport foi refinado em `docs/decisions/2026-08-18-tom-leve-identidade-assistente-pedro.md`. A primeira pergunta continua recebendo resposta e somente a insistência posterior escala.
