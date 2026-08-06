# Chat com Pedro como fila contextual do modo assisted

- Data: 06/08/2026
- Status: decisão confirmada pelo usuário

## Decisão

O Chat com Pedro é a camada operacional entre a análise da IA e a equipe. Ele
deve reunir não apenas conversas internas e escaladas, mas também as sugestões
pendentes do modo `assisted`, sempre vinculadas ao lead e à conversa do Inbox.

O Inbox continua sendo a fonte da conversa externa. O Chat com Pedro pode
exibir, editar, aprovar, ensinar ou descartar a sugestão, mas toda decisão de
envio passa pelo mesmo registro `ai_suggestion_review_requests` e pelas mesmas
validações transacionais do Inbox.

## Fluxo canônico

1. Pedro conclui uma execução `assisted` e persiste uma sugestão pendente.
2. O banco cria ou atualiza um tópico `lead_case` do lead no Chat com Pedro.
3. O tópico mostra a resposta exata proposta, a versão da conversa e um link
   para o Inbox.
4. Dono ou gestor aprova, edita e aprova, ensina ou descarta.
5. A revisão atualiza o tópico com o resultado e mantém a fila acionável quando
   ainda houver outra sugestão pendente para a conversa.

Existe no máximo um tópico ativo de sugestão por conversa; novas sugestões do
mesmo lead entram no histórico do tópico, evitando uma lista fragmentada.

## Limites

- Sugestões de `shadow` não entram na fila de aprovação humana.
- O Chat não envia silenciosamente ao lead.
- Conflitos de versão, opt-out, ownership, pausa, capacidade e demais gates
  continuam sendo revalidados no banco.
- Escaladas de pagamento, jurídico, fraude, intervenção humana, falha de
  provedor e call continuam usando seus tópicos próprios e devem apresentar
  motivo, evidência e decisão necessária, não uma mensagem genérica.

## Rollout e homologação

Validar uma sugestão `assisted` no Inbox e no Chat com Pedro, verificando que o
texto é idêntico, que a edição altera somente o texto enviado, que a aprovação
atualiza os dois lugares e que uma nova mensagem do lead invalida a versão
anterior antes de qualquer envio.
