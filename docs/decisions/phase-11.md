# Fase 11 — autosserviço de integrações

## Decisão

- somente o dono conecta, rotaciona ou revoga credenciais;
- Uazapi existente usa URL raiz + token e é validada em `GET /instance/status`;
- Meta oficial usa WABA ID + Phone Number ID + token permanente + App Secret e é validada pela Graph API;
- Embedded Signup continua fora do MVP, conforme o pacote técnico original;
- OpenAI BYOK é validada em `GET /v1/models`, que não produz inferência paga;
- segredos ficam no Supabase Vault; `integration_accounts` contém apenas metadados, hint mascarado e saúde;
- adapters e workers resolvem o segredo apenas por RPC concedida a `service_role`;
- revogação apaga o secret do Vault, revoga a conexão e pausa modelos ativos.

## Evidência

- migrações `phase_11_integration_self_service` e `phase_11_advisor_hardening` aplicadas ao banco remoto;
- smoke transacional comprovou gravação, leitura server-only e exclusão no Vault, com rollback integral;
- `anon` e `authenticated` não leem Vault/bindings nem executam a função de resolução;
- todas as tabelas públicas continuam com RLS;
- 33 testes, lint e build passaram sem teste visual.

## Limite na conclusão da fase

Na conclusão desta fase, o tráfego real ainda exigia adapters e worker. A Fase 12 implementou esse runtime; URL HTTPS, configuração do cron e homologação com contas reais continuam vinculadas ao deploy final.
