-- Executar em transação descartável com as identidades de teste da Fase 1.
begin;

-- Gate comprovado no banco remoto:
-- 1. duas requisições com o mesmo E.164 retornam reused_contact=true e
--    reused_opportunity=true na segunda;
-- 2. owner enxerga todos os leads do tenant;
-- 3. broker enxerga somente a oportunidade atribuída à sua membership;
-- 4. pending e owner de outro tenant enxergam zero oportunidades;
-- 5. Novo lead -> Em negociação falha com SQLSTATE 22023;
-- 6. expected_version obsoleto falha com SQLSTATE 40001;
-- 7. Novo lead -> Em atendimento -> Call agendada registra histórico e outbox.

rollback;
