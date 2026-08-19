# Canonicalização de celular brasileiro no WhatsApp

- Data: 19/08/2026
- Status: aprovada e implementada
- Escopo: contatos, campanhas e webhooks WhatsApp

## Decisão

Quando a Uazapi ou uma entrada do CRM trouxer um celular brasileiro no formato
legado de oito dígitos após o DDD, o Gril insere o nono dígito `9` antes de
comparar ou persistir a identidade E.164. A regra vale somente para `+55`, com
DDD informado e assinante iniciado por `6`, `7`, `8` ou `9`.

Telefones fixos brasileiros, números internacionais explícitos e celulares que
já possuem nove dígitos permanecem inalterados. O valor originalmente informado
continua preservado separadamente.

## Motivo

O WhatsApp pode devolver o JID brasileiro no formato anterior à inclusão do
nono dígito, enquanto campanhas e formulários já armazenam o número moderno.
Sem a equivalência canônica, a resposta do mesmo lead cria outro contato, outra
oportunidade e outra conversa.

## Efeito esperado

- a resposta de uma campanha entra na conversa em que a abertura foi enviada;
- o Inbox não cria outro card apenas pela ausência do nono dígito no provedor;
- a comparação continua exata depois da canonicalização, sem fusão por nome ou
  e-mail;
- duplicidades técnicas já comprovadas podem ser consolidadas de forma
  auditada, preservando mensagens e contexto no contato canônico.

## Relação com decisões anteriores

Esta decisão especializa a regra de telefone E.164 e deduplicação exata do
pacote técnico. Ela não autoriza inferir DDD, país ou identidade por outros
atributos.
