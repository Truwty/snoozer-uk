begin;

alter table snoozer.profiles add column username_changed_at timestamptz;
alter table snoozer.profiles add column studio_uid bigint generated always as identity unique check (studio_uid > 0);
comment on column snoozer.profiles.studio_uid is 'Stable numeric Studio reference. Not an authentication credential.';
alter table snoozer.profile_aliases add column is_username_redirect boolean not null default false;

create function public.get_my_profile_uid(p_profile uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare result bigint;
begin
  select studio_uid into result from snoozer.profiles where id = p_profile and owner_id = actor;
  if result is null then raise exception 'Profile unavailable' using errcode = '42501'; end if;
  return result;
end $$;
revoke execute on function public.get_my_profile_uid(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_my_profile_uid(uuid) to authenticated;

-- A redirect may alias the previous username, whose global registry row remains reserved.
create or replace function snoozer.reserve_public_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'reserved_names' then
    insert into snoozer.public_names values (new.name) on conflict do nothing;
  elsif tg_table_name = 'profiles' then
    if tg_op = 'INSERT' or new.username is distinct from old.username then
      insert into snoozer.public_names values (new.username) on conflict do nothing;
    end if;
  elsif tg_table_name = 'profile_aliases' and new.is_username_redirect then
    if tg_op = 'INSERT' or new.name is distinct from old.name then
      insert into snoozer.public_names values (new.name) on conflict do nothing;
    end if;
  elsif tg_op = 'INSERT' or new.name is distinct from old.name then
    insert into snoozer.public_names values (new.name);
  end if;
  return new;
end $$;
revoke execute on function snoozer.reserve_public_name() from public, anon, authenticated, service_role;

-- Renamed profile addresses remain usable forever, but cannot be manually retired or renewed.
create function snoozer.guard_username_redirect() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.is_username_redirect and new.profile_id is not null and (
    new.name is distinct from old.name or new.owner_id is distinct from old.owner_id
    or new.expires_at is distinct from old.expires_at or new.retired_at is distinct from old.retired_at
    or new.is_username_redirect is distinct from old.is_username_redirect
  ) then
    raise exception 'Username redirect is permanent' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function snoozer.guard_username_redirect() from public, anon, authenticated, service_role;
create trigger guard_username_redirect before update on snoozer.profile_aliases
  for each row execute function snoozer.guard_username_redirect();

create function public.rename_my_profile(p_profile uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  current_profile snoozer.profiles;
  inserted integer;
begin
  if p_profile is null or p_name is null or p_name !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' then
    raise exception 'Invalid username' using errcode = '22023';
  end if;

  perform 1 from auth.users where id = actor for update;
  select * into current_profile from snoozer.profiles where id = p_profile and owner_id = actor for update;
  if not found then raise exception 'Profile unavailable' using errcode = '42501'; end if;
  if current_profile.username = p_name then
    raise exception 'Username is already in use by this profile' using errcode = '22023';
  end if;
  if current_profile.username_changed_at > now() - interval '30 days' then
    raise exception 'Username can only be changed once every 30 days' using errcode = 'P1009';
  end if;

  -- Claim the global name key before touching the profile, so simultaneous claims cannot race.
  insert into snoozer.public_names(name) values (p_name) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted <> 1 then raise exception 'Username unavailable' using errcode = '23505'; end if;

  insert into snoozer.profile_aliases(name, profile_id, owner_id, expires_at, is_username_redirect)
    values (current_profile.username, current_profile.id, actor, '9999-12-31 23:59:59+00', true);
  update snoozer.profiles set username = p_name, username_changed_at = now(), updated_at = now()
    where id = current_profile.id and owner_id = actor;

  return jsonb_build_object('oldUsername', current_profile.username, 'username', p_name);
end $$;
revoke execute on function public.rename_my_profile(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.rename_my_profile(uuid,text) to authenticated;

create or replace function public.resolve_profile_alias(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select p.username
  from snoozer.profile_aliases a
  join snoozer.profiles p on p.id = a.profile_id and p.owner_id = a.owner_id
  where a.name = p_name and a.retired_at is null and p.published_revision is not null
    and (a.is_username_redirect or (a.expires_at > now()
      and (select count(*) from snoozer.profile_aliases earlier
        where earlier.owner_id = a.owner_id and not earlier.is_username_redirect
          and earlier.retired_at is null and earlier.expires_at > now()
          and (earlier.created_at, earlier.name) <= (a.created_at, a.name))
        <= coalesce((select (plan).aliases from snoozer.effective_plan(a.owner_id)), 0)))
$$;
revoke execute on function public.resolve_profile_alias(text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_profile_alias(text) to anon, authenticated;

create or replace function public.list_my_aliases(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  allowance integer := coalesce((select (plan).aliases from snoozer.effective_plan(actor)), 0);
begin
  if not exists(select 1 from snoozer.profiles where id = p_profile and owner_id = actor) then
    raise exception 'Profile unavailable' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'limit', allowance,
    'used', (select count(*) from snoozer.profile_aliases where owner_id = actor and not is_username_redirect
      and retired_at is null and expires_at > now()),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'expiresAt', a.expires_at,
        'isUsernameRedirect', a.is_username_redirect,
        'state', case when a.is_username_redirect then 'redirect'
          when a.retired_at is not null then 'retired' when a.expires_at <= now() then 'expired'
          when a.slot > allowance then 'plan-limit' when p.published_revision is null then 'unpublished' else 'active' end)
        order by a.is_username_redirect desc, a.created_at desc, a.name)
      from (
        select * from (
          select ranked.*, count(*) filter (where not is_username_redirect) over(partition by owner_id
            order by is_username_redirect desc, (retired_at is null and expires_at > now()) desc, created_at, name
            rows between unbounded preceding and current row) as slot
          from snoozer.profile_aliases ranked where owner_id = actor
        ) slotted where profile_id = p_profile
        order by is_username_redirect desc, created_at desc, name limit 100
      ) a join snoozer.profiles p on p.id = a.profile_id
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function public.list_my_aliases(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_my_aliases(uuid) to authenticated;

-- Public requests through an old username load the canonical snapshot; the route then redirects.
create or replace function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_snapshot(p.id, p.published_revision, true)
    || case when snoozer.ready_profile_domain(p.id) is not null
      then jsonb_build_object('custom_domain', snoozer.ready_profile_domain(p.id))
      when snoozer.profile_domain_candidate(p.id) is not null
      then jsonb_build_object('domain_renewal', snoozer.profile_domain_candidate(p.id))
      else '{}'::jsonb end
    || jsonb_build_object('badges', snoozer.public_profile_badges(p.id))
  from snoozer.profiles p
  where p.username = public.resolve_public_address(p_name) and p.published_revision is not null
    and not snoozer.public_profile_blocked(p.id, p.owner_id)
$$;
revoke all on function public.get_published_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.get_published_profile(text) to anon, authenticated;

commit;
