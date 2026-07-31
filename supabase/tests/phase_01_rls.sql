-- Execute em uma transação descartável. Os UUIDs devem apontar para usuários de teste
-- já existentes em auth.users. Este arquivo documenta a matriz mínima a validar pelo MCP.
begin;

-- Exemplo de identidade autenticada para testes manuais:
-- set local role authenticated;
-- select set_config(
--   'request.jwt.claims',
--   '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
--   true
-- );

-- Gate esperado para cada identidade:
-- 1. usuário sem membership: zero organizations e zero operations;
-- 2. membership pending: enxerga apenas a própria membership/profile;
-- 3. owner ativo: enxerga sua organização, todas as operações e equipe;
-- 4. broker ativo: enxerga apenas operações presentes em membership_operations;
-- 5. usuário da organização A: zero linhas da organização B;
-- 6. anon: nenhuma tabela pública do domínio possui grant.

rollback;
