-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. oito definições publicadas existem para a organização de teste;
-- 2. valor manual humano de preço total/entrada é persistido com fonte e validade;
-- 3. tentativa da IA de substituir valor humano retorna conflict e preserva o valor;
-- 4. projeto ativo compatível gera project_match elegível, evidência e snapshot;
-- 5. preço e entrada incompatíveis eliminam o projeto;
-- 6. corretor sem grant/call não lê catálogo, FAQ ou match da oportunidade;
-- 7. faq_creation_request cria entry + versão publicada + auditoria atomicamente.

rollback;
