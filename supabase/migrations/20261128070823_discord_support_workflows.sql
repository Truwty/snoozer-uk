create or replace function public.discord_bot_ticket_get(p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(t) from snoozer.discord_bot_tickets t where t.id=p_ticket_id
$$;

create or replace function public.discord_bot_ticket_statistics(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter(where status in ('open','claimed','waiting_member','waiting_staff')),
    'closed',count(*) filter(where status in ('closed','resolved')),
    'urgent',count(*) filter(where priority='urgent' and status in ('open','claimed','waiting_member','waiting_staff')),
    'high',count(*) filter(where priority='high' and status in ('open','claimed','waiting_member','waiting_staff')),
    'ratings',(
      select jsonb_build_object(
        'count',count(*),
        'average',round(avg((payload->>'rating')::numeric),2)
      )
      from snoozer.discord_bot_ticket_events e
      join snoozer.discord_bot_tickets t on t.id=e.ticket_id
      where t.guild_id=p_guild_id and e.event_type='rating'
        and coalesce(payload->>'rating','') ~ '^[1-5]$'
    ),
    'staff',(
      select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
        select coalesce(assigned_to,claimed_by) as staff_discord_id,
          count(*) filter(where status in ('closed','resolved'))::integer as resolved,
          count(*)::integer as total
        from snoozer.discord_bot_tickets
        where guild_id=p_guild_id and coalesce(assigned_to,claimed_by) is not null
        group by coalesce(assigned_to,claimed_by)
        order by resolved desc,total desc
        limit 20
      ) q
    )
  )
  from snoozer.discord_bot_tickets where guild_id=p_guild_id
$$;

create or replace function public.discord_bot_submission_review(
  p_id uuid,p_actor text,p_decision text,p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result snoozer.discord_bot_submissions;
begin
  if p_id is null or p_actor !~ '^[1-9][0-9]{16,19}$'
    or p_decision not in ('approved','rejected')
    or (p_note is not null and char_length(p_note)>1000) then
    raise exception 'Invalid community submission review';
  end if;
  update snoozer.discord_bot_submissions
  set status=p_decision,
    metadata=metadata||jsonb_build_object('staff_review',jsonb_build_object(
      'reviewed_by',p_actor,'decision',p_decision,'note',left(coalesce(p_note,''),1000),'reviewed_at',now()
    )),
    updated_at=now()
  where id=p_id and kind in ('suggestion','bug') and status='open'
  returning * into result;
  if not found then raise exception 'Submission not found or already reviewed'; end if;
  return to_jsonb(result);
end $$;

revoke all on function public.discord_bot_ticket_get(uuid),
  public.discord_bot_ticket_statistics(text),
  public.discord_bot_submission_review(uuid,text,text,text)
from public,anon,authenticated;
grant execute on function public.discord_bot_ticket_get(uuid),
  public.discord_bot_ticket_statistics(text),
  public.discord_bot_submission_review(uuid,text,text,text)
to service_role;
