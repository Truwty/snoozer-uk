create or replace function public.discord_bot_appeal_queue(p_guild_id text,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select a.id,a.case_id,a.appellant_discord_id,a.reason,a.status,a.created_at,
      c.case_number,c.action,c.reason as case_reason,c.guild_id,c.target_discord_id
    from snoozer.discord_bot_appeals a
    join snoozer.discord_bot_moderation_cases c on c.id=a.case_id
    where c.guild_id=p_guild_id and a.status in ('open','review')
    order by a.created_at limit least(greatest(coalesce(p_limit,25),1),100)
  ) q
$$;

revoke all on function public.discord_bot_appeal_queue(text,integer) from public,anon,authenticated;
grant execute on function public.discord_bot_appeal_queue(text,integer) to service_role;
