-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. pacote inicial contém uma persona e regra publicada por organização;
-- 2. UPDATE direto não ativa model_profile;
-- 3. model_activation_request exige owner + secret_reference;
-- 4. persona_publish_request mantém uma única versão published;
-- 5. ai_execution_request de simulador cria execução queued + outbox;
-- 6. modo live sem conversa é rejeitado;
-- 7. nenhuma chamada externa é feita sem secret BYOK concreto.

rollback;
