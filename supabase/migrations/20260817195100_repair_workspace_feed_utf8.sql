begin;

do $repair$
declare
  function_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.central_feed_page(uuid,uuid,text,integer,integer)'::regprocedure
  )
  into function_definition;

  repaired_definition := function_definition;
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('4e6f746966696361c383c2a7c383c2a36f', 'hex'), 'UTF8'), 'Notificação');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('6465636973c383c2a36f', 'hex'), 'UTF8'), 'decisão');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('4c696761c383c2a7c383c2a36f', 'hex'), 'UTF8'), 'Ligação');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('7265766973c383c2a36f', 'hex'), 'UTF8'), 'revisão');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('7072c383c2b378696d6f', 'hex'), 'UTF8'), 'próximo');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('72656174697661c383c2a7c383c2a36f', 'hex'), 'UTF8'), 'reativação');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('5665726966696361c383c2a7c383c2a36f', 'hex'), 'UTF8'), 'Verificação');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('636f6e636c75c383c2ad6461', 'hex'), 'UTF8'), 'concluída');
  repaired_definition := replace(repaired_definition, pg_catalog.convert_from(pg_catalog.decode('496e7465677261c383c2a7c383c2a36f', 'hex'), 'UTF8'), 'Integração');

  if repaired_definition <> function_definition then
    execute repaired_definition;
  end if;
end
$repair$;

commit;
