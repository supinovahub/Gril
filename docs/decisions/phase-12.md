# Fase 12 — runtime real

## Decisão

- Route Handler Node recebe webhooks nativos na URL por conexão;
- Meta usa desafio `hub.verify_token` derivado por conexão e valida `x-hub-signature-256` com o App Secret do tenant;
- Uazapi compara o token da instância em tempo constante, ignora grupos/eco e remove credenciais do payload persistido;
- inbox/outbox e PGMQ continuam at-least-once; os consumers são idempotentes e bounded;
- Pedro usa OpenAI Responses API com Structured Outputs estritos, chave BYOK resolvida server-side e contexto versionado;
- opt-out, privacidade e documento sensível eram interceptados antes do modelo nesta fase; essa ordem foi substituída por `contextual-controls-after-ai.md`, mantendo os efeitos determinísticos somente depois da análise contextual;
- cada envio revalida conexão, ownership, modo, opt-out e supressão; timeout ambíguo não é reenviado cegamente;
- campanhas, ofertas/lembretes de call, notificações e retenção usam os jobs duráveis existentes;
- Supabase Cron chama a rota protegida por `GRIL_WORKER_SECRET` depois que a URL final for conhecida.

## Evidência

- migração `phase_12_runtime_workers` aplicada ao projeto `frslhzwhaooqtivkzdez`;
- roteamento remoto confirmou inbound e execução de IA em `ai-turns`, envio em `outbound-whatsapp` e `pg_net` habilitado;
- contratos service-role das filas e do purge foram chamados em transação sem itens pendentes;
- 38 testes, TypeScript, lint e build de produção passaram sem teste visual;
- o cron final permanece deliberadamente sem URL até o deploy, evitando callback para um destino provisório.

## Limite atual

Nenhum provedor real foi acionado porque não há credencial/número de homologação anexado ao ambiente. A próxima etapa operacional é transferir o repositório, publicar na Vercel, configurar os segredos e executar o checklist do piloto com contas reais.
