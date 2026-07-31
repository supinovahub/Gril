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
- webhooks nativos com HMAC Meta/token Uazapi, normalização, recibos monotônicos e payload redigido;
- worker do Pedro via Responses API com Structured Outputs, BYOK do Vault, uma execução por inbound e revalidação antes do envio;
- consumidores de campanhas, lembretes/calls, notificações, filas PGMQ e purge físico pelo Supabase Storage;
- Supabase Cron configurável para chamar o worker HTTPS sem depender do plano de Cron da Vercel.

## Bloqueios externos para operação real

1. Fazer o deploy final em uma URL HTTPS pública e configurar `NEXT_PUBLIC_APP_URL`, `GRIL_WEBHOOK_INGEST_SECRET` e `GRIL_WORKER_SECRET`.
2. Conectar uma conta real pelo autosserviço e homologar entrada, assinatura, recibos e envio com payloads reais da Uazapi e/ou Meta Cloud.
3. Configurar o callback mostrado na tela do WhatsApp e ativar o cron do worker com a mesma URL/secret do deploy.
4. Homologar uma chave OpenAI real nos modos sombra e assistido antes de liberar produção.
5. Usar número autorizado e base com consentimento no piloto monitorado; comprovar um purge real de anexo antes da saída do piloto.

Esses itens são homologação e infraestrutura externa. Não há mais um componente de runtime conhecido por implementar, mas o sistema ainda não deve ser declarado ponta a ponta antes do teste real.
