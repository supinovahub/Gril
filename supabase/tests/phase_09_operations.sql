-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. sugestão nunca edita regra publicada;
-- 2. approve_draft cria rule_version draft + regression_case + regression_run queued;
-- 3. publicação sem regressão 100% passed e zero críticos é rejeitada;
-- 4. simulador cria execução isolada e fica blocked sem modelo/secret ativo;
-- 5. resultado observado: learning=approved, rule=draft, regression=queued, simulator=blocked;
-- 6. erro crítico de variante pausa variante e experimento e cria alerta persistente;
-- 7. custo/orçamento é legível apenas pelo owner;
-- 8. alertas e aprendizados mantêm auditoria de decisão.

rollback;
