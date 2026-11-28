create or replace function public.discord_bot_prune_backups(p_guild_id text,p_keep integer default 30)
returns integer language plpgsql security definer set search_path='' as $$
declare deleted integer;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or coalesce(p_keep,30) not between 1 and 100 then
    raise exception 'Invalid Discord backup retention request';
  end if;
  with retained as (
    select id from snoozer.discord_bot_server_backups
    where guild_id=p_guild_id
    order by created_at desc,id desc
    limit p_keep
  ), removed as (
    delete from snoozer.discord_bot_server_backups b
    where b.guild_id=p_guild_id and not exists(select 1 from retained r where r.id=b.id)
    returning b.id
  )
  select count(*)::integer into deleted from removed;
  return deleted;
end $$;

revoke all on function public.discord_bot_prune_backups(text,integer) from public,anon,authenticated;
grant execute on function public.discord_bot_prune_backups(text,integer) to service_role;
