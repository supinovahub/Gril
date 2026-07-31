-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. scheduled_job_request cria um único job por dedupe_key;
-- 2. private.dispatch_due_jobs publica o envelope em scheduled-actions;
-- 3. o job passa a leased com lease_until;
-- 4. capacidade proativa é bloqueada em 25;
-- 5. inbound vira backlog em 30;
-- 6. nenhuma fila está exposta pela Data API.

rollback;
