create or replace function public.discord_bot_appeal_queue(p_guild_id text,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select a.id,a.case_id,a.appellant_discord_id,a.reason,a.status,a.created_at,
      c.case_number,c.action,c.reason as case_reason,c.guild_id
    from snoozer.discord_bot_appeals a
    join snoozer.discord_bot_moderation_cases c on c.id=a.case_id
    where c.guild_id=p_guild_id and a.status in ('open','review')
    order by a.created_at limit least(greatest(coalesce(p_limit,25),1),100)
  ) q
$$;
create or replace function public.discord_bot_review_appeal(
  p_appeal_id uuid,p_reviewer text,p_decision text,p_response text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare appeal snoozer.discord_bot_appeals;
declare moderation_case snoozer.discord_bot_moderation_cases;
begin
  if p_appeal_id is null or p_reviewer !~ '^[1-9][0-9]{16,19}$'
    or p_decision not in ('accepted','rejected')
    or (p_response is not null and char_length(p_response)>2000) then raise exception 'Invalid appeal review'; end if;
  select * into appeal from snoozer.discord_bot_appeals where id=p_appeal_id for update;
  if not found or appeal.status not in ('open','review') then raise exception 'Appeal not found or already reviewed'; end if;
  select * into moderation_case from snoozer.discord_bot_moderation_cases where id=appeal.case_id for update;
  if not found or moderation_case.status not in ('active','appealed') then raise exception 'The related moderation case is no longer reviewable'; end if;
  update snoozer.discord_bot_appeals set status=p_decision,response=left(coalesce(p_response,''),2000),
    reviewed_by=p_reviewer,reviewed_at=now() where id=p_appeal_id;
  update snoozer.discord_bot_moderation_cases set status=case when p_decision='accepted' then 'overturned' else 'active' end,updated_at=now()
    where id=moderation_case.id;
  return jsonb_build_object('appeal_id',appeal.id,'case_id',moderation_case.id,'case_number',moderation_case.case_number,
    'target_discord_id',moderation_case.target_discord_id,'action',moderation_case.action,'decision',p_decision,'reason',moderation_case.reason);
end $$;
revoke all on function public.discord_bot_appeal_queue(text,integer),public.discord_bot_review_appeal(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.discord_bot_appeal_queue(text,integer),public.discord_bot_review_appeal(uuid,text,text,text) to service_role;
