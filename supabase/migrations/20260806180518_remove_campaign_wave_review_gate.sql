begin;

-- Campaign wave quality review is no longer a release gate. Keep the review
-- tables for historical compatibility, but future waves are released without
-- creating per-contact review rows or requiring a previous wave approval.
create or replace function private.process_campaign_wave_release_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_campaign public.campaigns%rowtype;
  v_wave_no int;
  v_wave uuid;
  v_contact public.campaign_contacts%rowtype;
  v_phone text;
  v_released int:=0;
  v_suppressed int:=0;
  v_required int;
  v_remaining int;
  v_slot timestamptz;
begin
  if (select auth.uid()) is null
     or new.actor_user_id<>(select auth.uid())
     or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_wave_forbidden' using errcode='42501';
  end if;

  select * into v_campaign
  from public.campaigns
  where id=new.campaign_id and org_id=new.org_id
  for update;

  if not found or v_campaign.status not in ('approved','running') then
    raise exception 'campaign_not_releasable' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.whatsapp_connections
    where id=v_campaign.connection_id and status='active' and campaign_enabled
  ) then
    raise exception 'active_campaign_connection_required' using errcode='22023';
  end if;
  if exists(
    select 1 from public.system_pauses
    where org_id=new.org_id and active
      and (scope_type in ('global','organization','proactive')
        or (scope_type='campaign' and scope_id=v_campaign.id))
  ) then
    raise exception 'campaign_pause_active' using errcode='55000';
  end if;

  select coalesce(max(wave_number),0)+1
  into v_wave_no
  from public.campaign_waves
  where campaign_id=v_campaign.id;

  if v_wave_no>3 then
    raise exception 'campaign_all_waves_released' using errcode='22023';
  end if;

  select count(*) into v_remaining
  from public.campaign_contacts
  where campaign_id=v_campaign.id and status='ready';
  if v_remaining=0 then
    raise exception 'campaign_no_remaining_contacts' using errcode='22023';
  end if;

  v_required:=case
    when v_wave_no=1 then least(20,v_remaining)
    when v_wave_no=2 then least(50,v_remaining)
    else v_remaining
  end;
  new.requested_count:=v_required;

  insert into public.campaign_waves(
    org_id,campaign_id,wave_number,requested_count,status,approved_by,approved_at
  ) values (
    new.org_id,v_campaign.id,v_wave_no,v_required,'draft',new.actor_user_id,now()
  ) returning id into v_wave;

  select greatest(
    now(),
    coalesce(max(run_at)+interval '1 minute',now())
  ) into v_slot
  from public.scheduled_jobs
  where target_queue='campaign-dispatch'
    and status in ('pending','leased')
    and payload->>'connection_id'=v_campaign.connection_id::text;

  for v_contact in
    select * from public.campaign_contacts
    where campaign_id=v_campaign.id and status='ready'
    order by priority desc,created_at
    for update skip locked
  loop
    select e164 into v_phone
    from public.contact_phones
    where contact_id=v_contact.contact_id and status='active'
    order by is_primary desc
    limit 1;

    if v_phone is null
       or exists(
         select 1 from public.opt_outs
         where operation_id=v_campaign.operation_id
           and contact_id=v_contact.contact_id
           and revoked_at is null
       )
       or exists(
         select 1 from public.suppression_entries
         where operation_id=v_campaign.operation_id
           and phone_e164=v_phone
           and revoked_at is null
           and (expires_at is null or expires_at>now())
       ) then
      update public.campaign_contacts
      set status='suppressed',wave_id=v_wave,
          suppression_reason='opt_out_or_suppression',
          last_revalidated_at=now(),updated_at=now()
      where id=v_contact.id;
      v_suppressed:=v_suppressed+1;
    else
      v_slot:=private.next_campaign_slot(v_campaign.operation_id,v_slot);
      insert into public.scheduled_jobs(
        org_id,operation_id,job_type,aggregate_type,aggregate_id,
        target_queue,run_at,dedupe_key,payload,created_by
      ) values (
        new.org_id,v_campaign.operation_id,'campaign.contact.dispatch',
        'campaign_contact',v_contact.id,'campaign-dispatch',v_slot,
        'campaign-contact:'||v_contact.id::text||':attempt:1',
        jsonb_build_object(
          'campaign_id',v_campaign.id,
          'campaign_contact_id',v_contact.id,
          'wave_id',v_wave,
          'connection_id',v_campaign.connection_id,
          'phone',v_phone
        ),new.actor_user_id
      );
      update public.campaign_contacts
      set status='queued',wave_id=v_wave,next_send_at=v_slot,
          last_revalidated_at=now(),updated_at=now()
      where id=v_contact.id;
      v_released:=v_released+1;
      v_slot:=v_slot+interval '1 minute';
    end if;

    exit when v_released>=v_required;
  end loop;

  update public.campaign_waves
  set status='released',released_count=v_released,
      suppressed_count=v_suppressed,review_required_count=0,
      review_completed_count=0,review_critical_count=0,
      review_status='approved',reviewed_by=null,reviewed_at=null,
      released_at=now()
  where id=v_wave;

  update public.campaigns
  set status='running',version=version+1,updated_at=now()
  where id=v_campaign.id;

  new.wave_id:=v_wave;
  new.released_count:=v_released;
  new.suppressed_count:=v_suppressed;
  new.processed_at:=now();

  insert into audit.events(
    org_id,actor_user_id,action,entity_type,entity_id,metadata
  ) values (
    new.org_id,new.actor_user_id,'campaign.wave_released','campaign_waves',v_wave,
    jsonb_build_object(
      'released',v_released,
      'suppressed',v_suppressed,
      'wave',v_wave_no,
      'review_required',0,
      'review_gate','disabled'
    )
  );
  return new;
end; $$;

-- Existing pending waves must not keep the old gate alive after deployment.
update public.campaign_waves
set review_status='approved',review_required_count=0,
    review_completed_count=0,review_critical_count=0,
    reviewed_by=null,reviewed_at=coalesce(reviewed_at,now())
where review_status<>'approved' or review_required_count>0;

-- Disable the old per-contact command without deleting its audit history.
create or replace function private.process_campaign_wave_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if (select auth.uid()) is null
     or new.actor_user_id<>(select auth.uid())
     or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_wave_review_forbidden' using errcode='42501';
  end if;
  new.resulting_status:='disabled';
  new.processed_at:=now();
  insert into audit.events(
    org_id,actor_user_id,action,entity_type,entity_id,metadata
  ) values (
    new.org_id,new.actor_user_id,'campaign.wave_review_disabled',
    'campaign_waves',new.wave_id,jsonb_build_object('review_id',new.review_id)
  );
  return new;
end; $$;

commit;
