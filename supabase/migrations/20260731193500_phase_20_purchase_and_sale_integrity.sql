begin;

alter table public.opportunities add column unit_quantity smallint not null default 1 check(unit_quantity between 1 and 100);
alter table public.opportunities add column amount_scope text not null default 'total' check(amount_scope in ('total','per_unit'));
alter table public.sales add column unit_reference text;
alter table public.sales add column unit_quantity smallint not null default 1 check(unit_quantity between 1 and 100);
alter table public.opportunity_stage_change_requests add column sale_unit_reference text;
alter table public.opportunity_stage_change_requests add column sale_unit_quantity smallint check(sale_unit_quantity between 1 and 100);

create table public.opportunity_purchase_structure_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  unit_quantity smallint not null check(unit_quantity between 1 and 100),
  amount_scope text not null check(amount_scope in ('total','per_unit')),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(opportunity_id,org_id) references public.opportunities(id,org_id) on delete restrict
);

create or replace function private.process_purchase_structure_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.can_access_opportunity(new.opportunity_id) then
    raise exception 'purchase_structure_forbidden' using errcode='42501'; end if;
  update public.opportunities set unit_quantity=new.unit_quantity,amount_scope=new.amount_scope,version=version+1,updated_at=now()
  where id=new.opportunity_id and org_id=new.org_id and status<>'won';
  if not found then raise exception 'purchase_structure_immutable' using errcode='22023'; end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'opportunity.purchase_structure_updated','opportunities',new.opportunity_id,
    jsonb_build_object('unit_quantity',new.unit_quantity,'amount_scope',new.amount_scope));
  new.processed_at:=now(); return new;
end; $$;
create trigger purchase_structure_request_process before insert on public.opportunity_purchase_structure_requests
for each row execute function private.process_purchase_structure_request();

create or replace function private.guard_stage_change_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_opportunity public.opportunities%rowtype;v_from_code text;v_to_code text;v_check public.opportunity_checklists%rowtype;v_missing integer;
begin
  select * into v_opportunity from public.opportunities where id=new.opportunity_id and org_id=new.org_id;
  select code into v_from_code from public.pipeline_stages where id=v_opportunity.pipeline_stage_id;
  select code into v_to_code from public.pipeline_stages where id=new.target_stage_id and org_id=new.org_id;
  if v_to_code='won' and not private.can_manage_crm(new.org_id) then raise exception 'sale_confirmation_manager_required' using errcode='42501'; end if;
  if v_to_code='won' and (new.sale_unit_quantity is null or char_length(trim(coalesce(new.sale_unit_reference,'')))<1) then
    raise exception 'sale_unit_and_quantity_required' using errcode='22023'; end if;
  if v_to_code<>'lost' and v_from_code in ('negotiation','proposal','documentation','payment') then
    select oc.* into v_check from public.opportunity_checklists oc join public.checklist_templates t on t.id=oc.template_id
    where oc.opportunity_id=new.opportunity_id and t.stage_code=v_from_code order by oc.created_at desc limit 1;
    if v_check.id is not null then
      select count(*) into v_missing from jsonb_array_elements(v_check.items_snapshot) item
      where coalesce((item->>'required')::boolean,true) and coalesce(v_check.completion->(item->>'id')->>'status','') not in ('completed','waived');
      if v_missing>0 then raise exception 'required_checklist_incomplete' using errcode='22023'; end if;
    end if;
  end if;
  return new;
end; $$;
create trigger a_stage_change_integrity_guard before insert on public.opportunity_stage_change_requests
for each row execute function private.guard_stage_change_integrity();

create or replace function private.apply_sale_detail_after_stage_change()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_to text;
begin
  select code into v_to from public.pipeline_stages where id=new.target_stage_id;
  if v_to='won' then
    update public.sales set unit_reference=trim(new.sale_unit_reference),unit_quantity=new.sale_unit_quantity,updated_at=now()
    where opportunity_id=new.opportunity_id and status<>'cancelled';
  end if;
  return new;
end; $$;
create trigger z_stage_change_apply_sale_detail before insert on public.opportunity_stage_change_requests
for each row execute function private.apply_sale_detail_after_stage_change();

do $$ declare v record;v_template uuid;begin
  for v in select id,org_id from public.operations loop
    if not exists(select 1 from public.checklist_templates where operation_id=v.id and stage_code='won' and status='published') then
      insert into public.checklist_templates(org_id,operation_id,stage_code,name)
      values(v.org_id,v.id,'won','Venda concluída') returning id into v_template;
      insert into public.checklist_items(org_id,template_id,position,label) values
        (v.org_id,v_template,1,'Contrato assinado'),(v.org_id,v_template,2,'Pagamento validado pela gestão'),
        (v.org_id,v_template,3,'Unidade e valor final registrados'),(v.org_id,v_template,4,'Corretor e mês/ano confirmados');
    end if;
  end loop;
end $$;

insert into public.opportunity_checklists(org_id,opportunity_id,template_id,template_version,items_snapshot)
select o.org_id,o.id,t.id,t.version,
  (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'label',i.label,'required',i.required) order by i.position),'[]'::jsonb) from public.checklist_items i where i.template_id=t.id)
from public.opportunities o join public.pipeline_stages s on s.id=o.pipeline_stage_id
join lateral(select * from public.checklist_templates ct where ct.operation_id=o.operation_id and ct.stage_code=s.code and ct.status='published' order by ct.version desc limit 1)t on true
where s.code in ('negotiation','proposal','documentation','payment','won')
on conflict(opportunity_id,template_id) do nothing;

alter table public.opportunity_purchase_structure_requests enable row level security;
create policy purchase_structure_requests_actor_select on public.opportunity_purchase_structure_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy purchase_structure_requests_insert on public.opportunity_purchase_structure_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.can_access_opportunity(opportunity_id)));
grant select,insert on public.opportunity_purchase_structure_requests to authenticated;
grant all on public.opportunity_purchase_structure_requests to service_role;
revoke all on function private.process_purchase_structure_request(),private.guard_stage_change_integrity(),private.apply_sale_detail_after_stage_change() from public,anon,authenticated,service_role;

commit;
