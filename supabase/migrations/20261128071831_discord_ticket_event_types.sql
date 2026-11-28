create or replace function public.discord_bot_ticket_action(
  p_ticket_id uuid,p_actor text,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket snoozer.discord_bot_tickets;
declare event_type text;
begin
  if p_ticket_id is null or p_actor !~ '^[1-9][0-9]{16,19}$'
    or p_action not in ('claim','assign','priority','close','reopen','waiting_member','waiting_staff','resolve','note','rating','escalate','transcript')
    or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then raise exception 'Invalid ticket action'; end if;
  select * into ticket from snoozer.discord_bot_tickets where id=p_ticket_id for update;
  if not found then raise exception 'Ticket not found'; end if;

  event_type:=case p_action
    when 'claim' then 'claimed'
    when 'assign' then 'assigned'
    when 'close' then 'closed'
    when 'resolve' then 'closed'
    when 'reopen' then 'reopened'
    when 'waiting_member' then 'status'
    when 'waiting_staff' then 'status'
    when 'escalate' then 'escalated'
    else p_action
  end;

  if p_action='claim' then
    update snoozer.discord_bot_tickets
      set claimed_by=p_actor,assigned_to=p_actor,status='claimed',updated_at=now()
      where id=p_ticket_id;
  elsif p_action='assign' then
    if coalesce(p_payload->>'assigned_to','') !~ '^[1-9][0-9]{16,19}$' then raise exception 'Invalid assignee'; end if;
    update snoozer.discord_bot_tickets
      set assigned_to=p_payload->>'assigned_to',updated_at=now()
      where id=p_ticket_id;
  elsif p_action='priority' then
    if p_payload->>'priority' not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
    update snoozer.discord_bot_tickets
      set priority=p_payload->>'priority',updated_at=now()
      where id=p_ticket_id;
  elsif p_action='close' or p_action='resolve' then
    update snoozer.discord_bot_tickets
      set status=case when p_action='resolve' then 'resolved' else 'closed' end,
        closed_at=now(),updated_at=now()
      where id=p_ticket_id;
  elsif p_action='reopen' then
    update snoozer.discord_bot_tickets
      set status='open',closed_at=null,updated_at=now()
      where id=p_ticket_id;
  elsif p_action='waiting_member' or p_action='waiting_staff' then
    update snoozer.discord_bot_tickets set status=p_action,updated_at=now() where id=p_ticket_id;
  elsif p_action='escalate' then
    update snoozer.discord_bot_tickets set updated_at=now() where id=p_ticket_id;
  elsif p_action='note' then
    if length(coalesce(p_payload->>'body','')) not between 1 and 3000 then raise exception 'Invalid staff note'; end if;
    insert into snoozer.discord_bot_staff_notes(ticket_id,author_discord_id,body)
      values(p_ticket_id,p_actor,p_payload->>'body');
  elsif p_action='rating' then
    if coalesce((p_payload->>'rating')::integer,0) not between 1 and 5 then raise exception 'Invalid rating'; end if;
  elsif p_action='transcript' then
    if jsonb_typeof(p_payload->'transcript')<>'array' or octet_length((p_payload->'transcript')::text)>524288 then
      raise exception 'Invalid transcript';
    end if;
    update snoozer.discord_bot_tickets set transcript=p_payload->'transcript',updated_at=now() where id=p_ticket_id;
  end if;

  insert into snoozer.discord_bot_ticket_events(ticket_id,actor_discord_id,event_type,payload)
    values(p_ticket_id,p_actor,event_type,coalesce(p_payload,'{}'::jsonb));
  select * into ticket from snoozer.discord_bot_tickets where id=p_ticket_id;
  return to_jsonb(ticket);
end $$;

revoke all on function public.discord_bot_ticket_action(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.discord_bot_ticket_action(uuid,text,text,jsonb) to service_role;
