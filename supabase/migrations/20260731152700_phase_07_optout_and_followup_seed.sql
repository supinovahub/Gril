begin;

create or replace function private.cancel_automation_after_opt_out()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.campaign_contacts
  set status='opted_out',suppression_reason='contact_opt_out',next_send_at=null,updated_at=now()
  where org_id=new.org_id and contact_id=new.contact_id
    and status in ('ready','queued','contacted','followup');

  update public.scheduled_jobs j
  set status='cancelled',updated_at=now()
  where j.org_id=new.org_id and j.status in ('pending','leased') and (
    (j.aggregate_type='campaign_contact' and exists (
      select 1 from public.campaign_contacts cc where cc.id=j.aggregate_id and cc.contact_id=new.contact_id
    ))
    or (j.aggregate_type='opportunity' and exists (
      select 1 from public.opportunities o where o.id=j.aggregate_id and o.contact_id=new.contact_id
    ))
  );

  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.recorded_by,'automation.cancelled_by_opt_out','contacts',new.contact_id,
    jsonb_build_object('operation_id',new.operation_id,'source',new.source));
  return new;
end; $$;
revoke all on function private.cancel_automation_after_opt_out() from public,anon,authenticated,service_role;
create trigger opt_out_cancel_automation after insert on public.opt_outs
for each row when (new.revoked_at is null) execute function private.cancel_automation_after_opt_out();

create or replace function private.seed_default_followup_plan(p_org_id uuid,p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_plan uuid;
begin
  if exists(select 1 from public.followup_plans where operation_id=p_operation_id and name='Cadência longa padrão' and version=1) then return; end if;
  insert into public.followup_plans (org_id,operation_id,name,version,status,max_attempts,horizon_days,published_at)
  values (p_org_id,p_operation_id,'Cadência longa padrão',1,'published',20,180,now()) returning id into v_plan;
  insert into public.followup_steps (org_id,plan_id,step_number,delay_minutes,instruction) values
    (p_org_id,v_plan,1,5,'Retomar naturalmente após o gap curto.'),
    (p_org_id,v_plan,2,60,'Perguntar se pode continuar em outro momento.'),
    (p_org_id,v_plan,3,240,'Enviar lembrete breve, sem repetir argumentos.'),
    (p_org_id,v_plan,4,720,'Fazer uma última tentativa no mesmo dia.'),
    (p_org_id,v_plan,5,1440,'Encerrar o ciclo de 24 horas de forma respeitosa.'),
    (p_org_id,v_plan,6,4320,'Retomar em três dias com contexto.'),
    (p_org_id,v_plan,7,10080,'Reabrir em uma semana com pergunta simples.'),
    (p_org_id,v_plan,8,20160,'Checar se o momento de compra mudou.'),
    (p_org_id,v_plan,9,30240,'Oferecer atualização objetiva do catálogo.'),
    (p_org_id,v_plan,10,43200,'Retomar em trinta dias sem pressão.'),
    (p_org_id,v_plan,11,57600,'Confirmar se ainda deseja receber opções.'),
    (p_org_id,v_plan,12,72000,'Revalidar região e faixa de preço.'),
    (p_org_id,v_plan,13,86400,'Oferecer curadoria curta se houver interesse.'),
    (p_org_id,v_plan,14,100800,'Perguntar se prefere pausar os contatos.'),
    (p_org_id,v_plan,15,115200,'Retomar apenas com contexto relevante.'),
    (p_org_id,v_plan,16,129600,'Revalidar o horizonte de compra.'),
    (p_org_id,v_plan,17,158400,'Apresentar atualização curta e verificável.'),
    (p_org_id,v_plan,18,187200,'Confirmar canal e momento preferido.'),
    (p_org_id,v_plan,19,216000,'Fazer a penúltima tentativa da cadência.'),
    (p_org_id,v_plan,20,259200,'Encerrar a cadência de seis meses com opt-out fácil.');
end; $$;
revoke all on function private.seed_default_followup_plan(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.seed_default_followup_for_operation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin perform private.seed_default_followup_plan(new.org_id,new.id); return new; end; $$;
revoke all on function private.seed_default_followup_for_operation() from public,anon,authenticated,service_role;
create trigger operations_seed_default_followup after insert on public.operations
for each row execute function private.seed_default_followup_for_operation();

do $$ declare v record; begin
  for v in select id,org_id from public.operations loop perform private.seed_default_followup_plan(v.org_id,v.id); end loop;
end $$;

commit;
