-- Gate executado no banco remoto em transação descartável.
begin;

-- 1. membro sem WhatsApp, opt-in ou regra semanal não recebe oferta;
-- 2. call de 20 minutos bloqueia 30 minutos da agenda;
-- 3. lead time abaixo de 1 hora cria alerta silencioso e não distribui automaticamente;
-- 4. preferred recebe oferta simultânea; comum usa 5/10/15 minutos;
-- 5. corretor destinatário enxerga a própria call/oferta, mas não outras;
-- 6. gate observado: status=assigned, version=3, active_assignments=1, reminder_jobs=3;
-- 7. estágio só virou call_scheduled depois do aceite;
-- 8. segundo aceite é bloqueado por row lock, versão e índice único;
-- 9. conflito de 30 minutos para o mesmo corretor é rejeitado;
-- 10. resultado é humano e Pedro não avança etapas pós-call.

rollback;
