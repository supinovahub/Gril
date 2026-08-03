begin;

create or replace function public.process_operational_whatsapp_reply(
  p_connection_id uuid,
  p_from_e164 text,
  p_external_event_id text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_membership public.memberships%rowtype;
  v_offer public.call_offers%rowtype;
  v_assignment public.call_assignments%rowtype;
  v_action text;
  v_body text;
  v_result jsonb;
  v_receipt uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;

  select * into v_connection
  from public.whatsapp_connections
  where id=p_connection_id and status='active';
  if not found then return jsonb_build_object('status','not_operational'); end if;

  select m.* into v_membership
  from public.memberships m
  join public.profiles p on p.user_id=m.user_id
  join public.membership_operations mo
    on mo.membership_id=m.id and mo.operation_id=v_connection.operation_id
  where m.org_id=v_connection.org_id
    and m.status='active'
    and p.whatsapp_e164=p_from_e164
  limit 1;
  if not found then return jsonb_build_object('status','not_operational'); end if;

  v_body:=translate(
    lower(trim(coalesce(p_body,''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
  v_action:=case
    when v_body~'^(aceito|aceitar|sim|ok|confirmo)\b' then 'accept'
    when v_body~'^(recuso|recusar|nao posso|não posso|declino)\b' then 'decline'
    when v_body~'^(devolver|devolvo|retornar|nao consigo atender|não consigo atender)\b' then 'return'
    else 'unknown'
  end;

  -- Team numbers are only an operational channel while an actionable offer
  -- or assignment exists. Ordinary messages must continue to the Inbox.
  if v_action='unknown' then
    return jsonb_build_object('status','not_operational');
  end if;

  select id into v_receipt
  from private.operational_reply_receipts
  where connection_id=p_connection_id and external_event_id=p_external_event_id;
  if v_receipt is not null then
    return jsonb_build_object('status','duplicate','operational',true,'receipt_id',v_receipt);
  end if;

  if v_action in ('accept','decline') then
    select o.* into v_offer
    from public.call_offers o
    join public.calls c on c.id=o.call_id
    where o.recipient_membership_id=v_membership.id
      and o.status='pending'
      and o.expires_at>now()
      and c.operation_id=v_connection.operation_id
    order by o.created_at desc
    limit 1;
    if not found then return jsonb_build_object('status','not_operational'); end if;
    v_result:=private.apply_call_member_action(
      v_offer.call_id,
      v_membership.id,
      v_action,
      v_offer.id,
      v_membership.user_id
    );
  else
    select a.* into v_assignment
    from public.call_assignments a
    join public.calls c on c.id=a.call_id
    where a.membership_id=v_membership.id
      and a.active
      and c.operation_id=v_connection.operation_id
      and c.starts_at>now()
    order by c.starts_at
    limit 1;
    if not found then return jsonb_build_object('status','not_operational'); end if;
    v_result:=private.apply_call_member_action(
      v_assignment.call_id,
      v_membership.id,
      'return',
      null,
      v_membership.user_id
    );
  end if;

  insert into private.operational_reply_receipts(
    org_id,connection_id,membership_id,external_event_id,normalized_action,result
  ) values(
    v_connection.org_id,p_connection_id,v_membership.id,
    left(p_external_event_id,300),v_action,v_result
  ) returning id into v_receipt;

  return v_result||jsonb_build_object('operational',true,'receipt_id',v_receipt);
end;
$$;

revoke all on function public.process_operational_whatsapp_reply(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.process_operational_whatsapp_reply(uuid,text,text,text)
  to service_role;

commit;
