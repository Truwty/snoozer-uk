-- Require an authenticated Discord identity and ownership of the submitted Snoozer profile before Creator review.
create or replace function public.discord_bot_creator_request(p_discord_user_id text,p_profile_url text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid;
declare requested_username text;
declare profile_match text[];
declare result uuid;
begin
  profile_match:=regexp_match(coalesce(p_profile_url,''),'^https://(?:www\.)?snoozer\.uk/([A-Za-z0-9-]{2,30})/?$');
  if p_discord_user_id !~ '^[1-9][0-9]{16,19}$' or profile_match is null
    or length(coalesce(p_reason,'')) not between 15 and 1500 then
    raise exception 'Invalid Creator verification request';
  end if;
  requested_username:=profile_match[1];
  select i.user_id into owner
  from auth.identities i
  where i.provider='discord' and i.provider_id=p_discord_user_id
  limit 1;
  if owner is null then
    raise exception 'Link your Discord account to Snoozer before requesting Creator verification';
  end if;
  if not exists(
    select 1 from snoozer.profiles p
    where p.owner_id=owner and lower(p.username)=lower(requested_username)
  ) then
    raise exception 'The submitted Snoozer profile does not belong to your linked account';
  end if;
  insert into snoozer.discord_bot_creator_verifications(owner_id,discord_user_id,profile_url,reason)
  values(owner,p_discord_user_id,p_profile_url,p_reason)
  returning id into result;
  return result;
end $$;

revoke all on function public.discord_bot_creator_request(text,text,text) from public,anon,authenticated;
grant execute on function public.discord_bot_creator_request(text,text,text) to service_role;
