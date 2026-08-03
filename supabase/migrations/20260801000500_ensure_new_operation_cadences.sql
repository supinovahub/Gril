begin;

-- This function is called by the existing operations_seed_default_followup
-- trigger. It must seed every required cadence, including operations created by
-- self-service onboarding after the homologation migration was applied.
create or replace function private.seed_default_followup_plan(p_org_id uuid, p_operation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_plan uuid;
begin
  if not exists (
    select 1 from public.followup_plans
    where operation_id = p_operation_id
      and name = 'Cadencia longa padrao'
      and version = 2
      and status = 'published'
  ) then
    insert into public.followup_plans(
      org_id, operation_id, name, version, status, max_attempts, horizon_days, published_at
    ) values (
      p_org_id, p_operation_id, 'Cadencia longa padrao', 2, 'published', 20, 180, now()
    ) returning id into v_plan;

    insert into public.followup_steps(org_id, plan_id, step_number, delay_minutes, instruction) values
      (p_org_id,v_plan,1,5,'Retomar naturalmente no inicio da cadencia.'),
      (p_org_id,v_plan,2,1440,'Retomar em um dia.'),
      (p_org_id,v_plan,3,2880,'Retomar em dois dias.'),
      (p_org_id,v_plan,4,5760,'Retomar em quatro dias.'),
      (p_org_id,v_plan,5,10080,'Retomar em sete dias.'),
      (p_org_id,v_plan,6,14400,'Retomar em dez dias.'),
      (p_org_id,v_plan,7,20160,'Retomar em quatorze dias.'),
      (p_org_id,v_plan,8,30240,'Retomar em vinte e um dias.'),
      (p_org_id,v_plan,9,43200,'Retomar em trinta dias.'),
      (p_org_id,v_plan,10,64800,'Retomar em quarenta e cinco dias.'),
      (p_org_id,v_plan,11,86400,'Retomar em sessenta dias.'),
      (p_org_id,v_plan,12,108000,'Retomar em setenta e cinco dias.'),
      (p_org_id,v_plan,13,129600,'Retomar em noventa dias.'),
      (p_org_id,v_plan,14,151200,'Retomar em cento e cinco dias.'),
      (p_org_id,v_plan,15,172800,'Retomar em cento e vinte dias.'),
      (p_org_id,v_plan,16,194400,'Retomar em cento e trinta e cinco dias.'),
      (p_org_id,v_plan,17,216000,'Retomar em cento e cinquenta dias.'),
      (p_org_id,v_plan,18,230400,'Retomar em cento e sessenta dias.'),
      (p_org_id,v_plan,19,244800,'Retomar em cento e setenta dias.'),
      (p_org_id,v_plan,20,259200,'Encerrar a cadencia em cento e oitenta dias com opt-out facil.');
  end if;

  if not exists (
    select 1 from public.followup_plans
    where operation_id = p_operation_id and name = 'Cadencia curta padrao' and status = 'published'
  ) then
    insert into public.followup_plans(
      org_id, operation_id, name, version, status, max_attempts, horizon_days, published_at
    ) values (
      p_org_id, p_operation_id, 'Cadencia curta padrao', 1, 'published', 5, 1, now()
    ) returning id into v_plan;

    insert into public.followup_steps(org_id, plan_id, step_number, delay_minutes, instruction) values
      (p_org_id,v_plan,1,60,'Retomar em uma hora.'),
      (p_org_id,v_plan,2,240,'Retomar em quatro horas.'),
      (p_org_id,v_plan,3,480,'Retomar em oito horas.'),
      (p_org_id,v_plan,4,840,'Retomar em quatorze horas.'),
      (p_org_id,v_plan,5,1320,'Encerrar a cadencia curta em vinte e duas horas.');
  end if;

  if not exists (
    select 1 from public.followup_plans
    where operation_id = p_operation_id and name = 'Cadencia no-show' and status = 'published'
  ) then
    insert into public.followup_plans(
      org_id, operation_id, name, version, status, max_attempts, horizon_days, published_at
    ) values (
      p_org_id, p_operation_id, 'Cadencia no-show', 1, 'published', 5, 2, now()
    ) returning id into v_plan;

    insert into public.followup_steps(org_id, plan_id, step_number, delay_minutes, instruction) values
      (p_org_id,v_plan,1,10,'Confirmar se houve imprevisto.'),
      (p_org_id,v_plan,2,120,'Oferecer reagendamento em duas horas.'),
      (p_org_id,v_plan,3,480,'Retomar em oito horas.'),
      (p_org_id,v_plan,4,1440,'Retomar em vinte e quatro horas.'),
      (p_org_id,v_plan,5,2880,'Encerrar no-show em quarenta e oito horas.');
  end if;

  if not exists (
    select 1 from public.followup_plans
    where operation_id = p_operation_id and name = 'Compra futura' and status = 'published'
  ) then
    insert into public.followup_plans(
      org_id, operation_id, name, version, status, max_attempts, horizon_days, published_at
    ) values (
      p_org_id, p_operation_id, 'Compra futura', 1, 'published', 3, 180, now()
    ) returning id into v_plan;

    insert into public.followup_steps(org_id, plan_id, step_number, delay_minutes, instruction) values
      (p_org_id,v_plan,1,129600,'Retomar noventa dias antes do mes alvo.'),
      (p_org_id,v_plan,2,43200,'Retomar trinta dias antes do mes alvo.'),
      (p_org_id,v_plan,3,10080,'Retomar sete dias antes do mes alvo.');
  end if;
end;
$$;

revoke all on function private.seed_default_followup_plan(uuid, uuid)
  from public, anon, authenticated, service_role;

do $$
declare
  v_operation record;
begin
  for v_operation in select id, org_id from public.operations where status <> 'archived'
  loop
    perform private.seed_default_followup_plan(v_operation.org_id, v_operation.id);
  end loop;
end;
$$;

commit;
