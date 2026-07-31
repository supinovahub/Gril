-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. criação exige conexão ativa/campaign_enabled e declaração de consentimento;
-- 2. importação com dois telefones e uma repetição retorna 2 válidos + 1 duplicado;
-- 3. aprovação exige status review e ao menos um contato ready;
-- 4. opt-out antes da onda muda o contato para suppressed/opted_out;
-- 5. primeira onda cria no máximo 20 jobs idempotentes; segunda, no máximo 50;
-- 6. resultado observado no gate: queued=1, suppressed=1, duplicates=1, pending_jobs=1;
-- 7. broker e usuário de outra organização não leem nem operam campanhas;
-- 8. opt-out posterior cancela jobs de campanha/follow-up ainda pendentes.

rollback;
