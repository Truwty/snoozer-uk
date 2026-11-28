-- Resolve the member-summary PL/pgSQL name collision and expose poll voter results
-- exclusively to the Discord worker's service-role connection.

create or replace function public.discord_bot_member_summary(p_discord_user_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner uuid;
declare profile_name text;
declare profile_display_name text;
declare plan_name text;
declare premium boolean;
declare creator boolean;
begin
  if p_discord_user_id !~ '^[1-9][0-9]{16,19}$' then return null; end if;
  select i.user_id into owner
    from auth.identities as i
    where i.provider='discord' and i.provider_id=p_discord_user_id
    limit 1;
  if owner is null then return jsonb_build_object('linked',false); end if;

  select p.username,p.display_name
    into profile_name,profile_display_name
    from snoozer.profiles as p
    where p.owner_id=owner
    order by p.created_at
    limit 1;

  select e.plan into plan_name
    from snoozer.entitlement_grants as e
    where e.owner_id=owner and e.revoked_at is null and e.starts_at<=now()
      and (e.expires_at is null or e.expires_at>now()) and not coalesce(e.payment_held,false)
      and e.plan in ('plus','pro','studio')
    order by case e.plan when 'studio' then 1 when 'pro' then 2 else 3 end
    limit 1;

  premium:=plan_name is not null;
  select exists(
    select 1 from snoozer.discord_bot_creator_verifications as v
    where v.discord_user_id=p_discord_user_id and v.status='approved'
  ) into creator;

  return jsonb_build_object(
    'linked',true,
    'username',profile_name,
    'display_name',profile_display_name,
    'premium',premium,
    'plan',plan_name,
    'creator',creator,
    'profile_url',case when profile_name is null then null else 'https://snoozer.uk/'||profile_name end
  );
end $$;

create or replace function public.discord_bot_poll_results(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_id is null then raise exception 'Invalid poll reference'; end if;

  select jsonb_build_object(
    'total',(
      select count(*)::integer
      from snoozer.discord_bot_votes as v
      where v.submission_id=s.id
    ),
    'options',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'choice',opt.value,
          'votes',(
            select count(*)::integer
            from snoozer.discord_bot_votes as v
            where v.submission_id=s.id and v.choice=opt.value
          ),
          'voters',coalesce((
            select jsonb_agg(v.voter_discord_id order by v.created_at)
            from snoozer.discord_bot_votes as v
            where v.submission_id=s.id and v.choice=opt.value
          ),'[]'::jsonb)
        ) order by opt.ordinality
      )
      from jsonb_array_elements_text(coalesce(s.metadata->'options','[]'::jsonb))
        with ordinality as opt(value,ordinality)
    ),'[]'::jsonb)
  )
  into result
  from snoozer.discord_bot_submissions as s
  where s.id=p_id and s.kind='poll' and s.status in ('open','approved');

  if not found then raise exception 'Poll is not available'; end if;
  return result;
end $$;

revoke all on function public.discord_bot_poll_results(uuid) from public,anon,authenticated;
grant execute on function public.discord_bot_poll_results(uuid) to service_role;
