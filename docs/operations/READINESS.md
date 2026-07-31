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
- qualificação, curadoria de imóveis, criação de call e follow-ups autônomos validados por ferramenta OpenAI estrita;
- áudio, imagem, documento sensível, edição/exclusão/reação, resumo versionado e score explicável;
- PWA, busca global, web push e link HTTPS de videochamada com alerta T-15;
- cem casos de regressão ativos, sendo cinquenta e dois críticos;
- Supabase Cron configurável para chamar o worker HTTPS sem depender do plano de Cron da Vercel.

## Infraestrutura concluída em 31/07/2026

- produção publicada em `https://gril-lac.vercel.app`;
- variáveis server-side, URL pública e par VAPID configurados na Vercel;
- Supabase Cron ativo a cada minuto, com URL e bearer armazenados no Vault;
- execuções automáticas do worker registradas como `healthy` depois do deploy final;
- login, redirecionamento da área privada, manifest, service worker e ícone validados por HTTP.

## Homologações externas pendentes

1. Conectar uma conta real pelo autosserviço e homologar entrada, assinatura, recibos e envio com payloads reais da Uazapi e/ou Meta Cloud.
2. Configurar no provedor o callback mostrado na tela do WhatsApp.
3. Homologar uma chave OpenAI real nos modos sombra e assistido antes de liberar o modo autônomo.
4. Usar número autorizado e base com consentimento no piloto monitorado; comprovar push, purge real de anexo e restauração de backup antes da saída do piloto.

## Limitação do plano atual

O advisor mantém o warning de proteção contra senhas vazadas. Segundo a documentação do Supabase, esse recurso está disponível apenas no plano Pro ou superior; o projeto está no plano Free.

Não há componente conhecido do caminho crítico da seção 39 ainda por implementar, mas o sistema não deve ser declarado ponta a ponta antes dos testes reais descritos em `MVP_VALIDATION_FLOWS.md`.
