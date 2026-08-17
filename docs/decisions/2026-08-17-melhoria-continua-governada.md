# Melhoria contínua governada do Pedro

- Data: 17/08/2026
- Status: decisão aprovada pelo pedido atual do usuário

## Decisão

O Pedro passa a ter um loop de melhoria contínua por organização, sem autoalteração. O fluxo canônico é:

`sinal → agrupamento do meta-revisor → proposta do Lionel → decisão humana → rascunho → regressão completa → publicação pelo dono`.

O meta-revisor pode encontrar recorrências e propor mudanças, mas não pode publicar regras, editar o prompt central nem promover a própria recomendação. Todo sinal, cluster, candidato, versão e decisão permanece no tenant que o originou.

## Fontes e classificação

Entram como sinais: correções humanas, sugestões descartadas, falhas ou bloqueios de execução, escaladas e baixa confiança. O revisor recebe somente evidência limitada e anonimizada; transcrições privadas completas não são persistidas na fila de sinais.

Cada achado separa a causa provável entre `skill`, conhecimento, prompt central, runtime, dados ou desconhecido. Somente candidatos classificados como `skill` e como exemplo ou regra potencial podem virar comportamento modular. Achados isolados ou não modulares podem virar apenas cenário de regressão. Mudanças técnicas, de dados, conhecimento ou prompt central continuam exigindo trabalho humano específico e não podem ser disfarçadas como skill.

## Skills e publicação

Uma skill é um módulo pequeno, versionado e testável, com gatilho, instrução, exemplos e ações permitidas/proibidas. A aprovação humana cria uma versão `draft`, compila um snapshot imutável dentro de uma nova `rule_version` e executa todos os casos de regressão.

Há no máximo um pacote de regras e uma regressão ativa por organização. A publicação exige dono, 100% dos casos aprovados e zero falha crítica. A publicação promove as skills do pacote atomicamente; as versões anteriores são arquivadas. Reincidência de um padrão resolvido reabre uma nova decisão, sem alterar silenciosamente a versão publicada.

## Automação permitida

O worker pode iniciar no máximo um ciclo automático por organização a cada 24 horas quando houver pelo menos três sinais novos. Um gestor também pode solicitar a análise manualmente. Em ambos os casos, a automação termina em proposta e fila humana.

As regras rígidas de segurança, autorização, opt-out, produção e execução exata continuam no código e no banco. Este mecanismo não substitui esses gates, não faz fine-tuning contínuo e não compartilha aprendizado entre organizações.

## Rollout

A migration `20260817200000_continuous_improvement_loop.sql`, o worker e a interface devem ser publicados juntos. Nesta branch a migration permanece local e não foi aplicada ao Supabase remoto único.
