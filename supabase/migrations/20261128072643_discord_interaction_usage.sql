create or replace function public.discord_bot_interaction_usage(p_days integer default 30,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'total',(select count(*)::integer from snoozer.discord_bot_interaction_receipts
      where processed_at>=now()-make_interval(days=>least(greatest(coalesce(p_days,30),1),365))),
    'types',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
      select interaction_type,count(*)::integer as uses,max(processed_at) as last_used
      from snoozer.discord_bot_interaction_receipts
      where processed_at>=now()-make_interval(days=>least(greatest(coalesce(p_days,30),1),365))
      group by interaction_type order by uses desc,interaction_type limit least(greatest(coalesce(p_limit,25),1),100)
    ) q)
  )
$$;
revoke all on function public.discord_bot_interaction_usage(integer,integer) from public,anon,authenticated;
grant execute on function public.discord_bot_interaction_usage(integer,integer) to service_role;
