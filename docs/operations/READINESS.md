# Readiness do MVP

## Pronto e verificável sem fornecedores

- autenticação, aprovação, papéis, multi-tenancy e RLS;
- CRM, pipeline, inbox e comandos atômicos;
- filas, jobs, capacidade, campanhas, opt-out e follow-ups;
- Pedro versionado, BYOK por referência, modos e gates humanos;
- conhecimento, qualificação, projetos, FAQ e conflitos;
- agenda, distribuição, pós-call, central, relatórios e aprendizado;
- Meta tardio, privacidade, retenção, simulador e regressão.

## Bloqueios externos para operação real

1. Credencial e payload/documentação concretos da Uazapi ou Meta Cloud para implementar e homologar o adapter de entrada, status e envio.
2. Chave BYOK da OpenAI para ativar o worker de inferência e medir qualidade/custo reais.
3. Worker com acesso ao Supabase Storage para comprovar purge físico de anexos sensíveis.
4. Número autorizado e base com consentimento para o piloto monitorado.

Esses itens não bloqueiam uso local das telas e contratos, mas bloqueiam declarar o sistema operacional ponta a ponta.
