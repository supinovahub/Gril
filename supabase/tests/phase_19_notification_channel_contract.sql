begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(3);

select extensions.ok(
  pg_get_functiondef('public.submit_access_request(text,text,text,text,text,text,text,text,text,integer,text)'::regprocedure)
    not like '%''in_app''%',
  'access request submission uses the canonical app notification channel'
);

select extensions.ok(
  pg_get_functiondef('public.decide_access_request(uuid,text,text,uuid[],text,text,text)'::regprocedure)
    not like '%''in_app''%',
  'access request decisions use the canonical app notification channel'
);

select extensions.ok(
  pg_get_functiondef('public.decide_access_request(uuid,text,text,uuid[],text,text,text)'::regprocedure)
    like '%''app''%',
  'approved access notification remains enabled after the correction'
);

select * from extensions.finish();

rollback;
