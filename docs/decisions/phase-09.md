# Fase 9 — Central, relatórios, simulador e aprendizado

## Escopo entregue

- Central persistente para alertas, escaladas, calls, campanhas, capacidade e saúde;
- assumir/resolver com trilha de auditoria;
- relatórios separados de funil, campanhas, calls, resultados, autonomia, capacidade e custo;
- custo visível somente ao dono;
- sugestões de aprendizado com evidência, escopo, conflito e decisão humana;
- aprovação cria nova versão de regras em rascunho e caso de regressão;
- publicação exige dono, regressão 100% aprovada e zero falha crítica;
- simulador isolado sem qualquer efeito em WhatsApp, CRM, call ou campanha;
- contratos de experimento com atribuição estável e pausa automática por erro crítico.

## Gate da fase

- aprendizado manual aprovado resultou em regra `draft`, nunca `published`;
- um caso de regressão e uma execução `queued` foram criados;
- simulador sem modelo/secret ficou `blocked`, sem efeitos externos;
- alerta e revisão de aprendizado geram auditoria;
- corretor continua restrito aos próprios dados operacionais;
- lint, testes e build passaram com 25 rotas.

## Dependência externa

Sem chave OpenAI ativa, execuções de simulador e regressão permanecem bloqueadas. Isso impede publicação acidental de aprendizado ainda não testado.
