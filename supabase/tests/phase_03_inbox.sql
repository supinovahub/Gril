-- Gate executado no Supabase remoto dentro de uma transação descartável.
begin;

-- 1. service_role cria conexão ativa somente para o cenário de teste;
-- 2. dois eventos com o mesmo external_event_id geram uma mensagem;
-- 3. contato, oportunidade e conversa são criados no mesmo fluxo;
-- 4. owner lê e enfileira resposta humana;
-- 5. broker sem access grant lê zero conversas;
-- 6. broker atribuído com access grant lê conversa e telefone;
-- 7. toda a massa de gate é revertida.

rollback;
