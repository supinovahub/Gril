# Readiness do MVP

## Pronto e verificável sem fornecedores

- autenticação, aprovação, papéis, multi-tenancy e RLS;
- CRM, pipeline, inbox e comandos atômicos;
- filas, jobs, capacidade, campanhas, opt-out e follow-ups;
- Pedro versionado, BYOK OpenAI validado e armazenado no Vault, modos e gates humanos;
- conhecimento, qualificação, projetos, FAQ e conflitos;
- agenda, distribuição, pós-call, central, relatórios e aprendizado;
- Meta tardio, privacidade, retenção, simulador e regressão;
- autosserviço owner-only para Uazapi, Meta oficial e OpenAI, com teste, rotação, revogação, RLS, auditoria e health check.

## Bloqueios externos para operação real

1. Conectar uma conta real pelo autosserviço e homologar os adapters de entrada, assinatura, status e envio com payloads reais da Uazapi e/ou Meta Cloud.
2. Implementar e homologar o worker de inferência usando a chave OpenAI recuperada server-side do Vault.
3. Implementar o worker com acesso ao Supabase Storage para comprovar purge físico de anexos sensíveis.
4. Disponibilizar uma URL HTTPS pública para webhooks; `localhost` não recebe callbacks dos provedores.
5. Usar número autorizado e base com consentimento no piloto monitorado.

Esses itens não bloqueiam uso local das telas e contratos, mas bloqueiam declarar o sistema operacional ponta a ponta.
