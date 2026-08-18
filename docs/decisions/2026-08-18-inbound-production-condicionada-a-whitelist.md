# Produção inbound condicionada à whitelist

- Data: 18/08/2026
- Status: decisão confirmada pelo pedido atual do usuário

## Decisão

O atendimento normal (`journey = inbound`) volta a oferecer o modo
`production`, com liberação controlada por `ai_test_allowlist`.

A existência de ao menos um número ativo na whitelist apenas faz a opção
**Responde automaticamente** aparecer junto de `off`, `shadow` e `assisted`.
Ela não altera o modo atual. Somente o dono pode selecionar `production`
explicitamente, e a mudança continua sujeita aos portões de prontidão do banco.

Em `production`, somente conversas cujo telefone ativo esteja na whitelist da
organização podem criar execução, iniciar o worker e inserir mensagem outbound
da IA. Contatos fora da lista continuam entrando no Inbox, sem resposta
automática.

## Separação da reativação

Campanhas de reativação mantêm configuração, proveniência e release próprios.
`test_controlled` exige whitelist; `released` pode alcançar os contatos
elegíveis da campanha, sempre respeitando opt-out, supressão, conexão, pausa e
os demais gates determinísticos.

Esta decisão substitui `docs/decisions/reactivation-production-only.md` apenas
no ponto em que aquele documento proibia `production` no inbound normal. A
restrição de production a campanhas do tipo `reactivation` continua válida no
domínio de campanhas.

## Portões

- sem número ativo na whitelist, a interface não mostra `production` e a
  Server Action recusa uma tentativa forjada;
- a transição para `production` exige whitelist ativa e todos os portões de
  identidade, conhecimento, modelos, canal e regressão;
- a mudança de modo não ocorre ao cadastrar um número; depende de seleção
  explícita do dono;
- conversas inbound ativas e sob ownership da IA acompanham a mudança global;
- elegibilidade, claim do worker e trigger final revalidam o destinatário;
- remover um número invalida imediatamente novas execuções e envios para ele;
- reativação permanece independente do modo inbound.

## Rollout e rollback

Código e migration devem ser publicados juntos. O rollback restaura o modo
inbound para `assisted`, remove `production` da interface e volta a proibir o
valor nos settings, sem apagar a whitelist nem o histórico de auditoria.
