-- Existing profiles keep their object paths. Each new profile has its own storage namespace.
alter table snoozer.profiles add column media_scope uuid;
update snoozer.profiles set media_scope = owner_id;
alter table snoozer.profiles alter column media_scope set not null,
  alter column media_scope set default gen_random_uuid(),
  add unique (media_scope);

-- Keep stale editor tabs from writing to a replacement profile with the same owner.
create table snoozer.profile_revision_floor (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  next_revision integer not null,
  last_reclaim_at timestamptz
);
alter table snoozer.profile_revision_floor enable row level security;

create table snoozer.avatar_cleanup (
  scope uuid primary key,
  available_at timestamptz not null,
  lease_token uuid,
  failures integer not null default 0,
  dead_at timestamptz
);
alter table snoozer.avatar_cleanup enable row level security;
create index avatar_cleanup_ready on snoozer.avatar_cleanup (available_at) where dead_at is null;

create function snoozer.retire_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into snoozer.reserved_names(name) values (old.username) on conflict do nothing;
  -- Signed uploads last two hours. Leave room for in-flight signing and upload requests.
  insert into snoozer.avatar_cleanup(scope, available_at) values (old.media_scope, clock_timestamp() + interval '3 hours');
  return old;
end $$;

create trigger retire_profile before delete on snoozer.profiles
for each row execute function snoozer.retire_profile();

create or replace function public.claim_profile(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform 1 from auth.users where id = actor for update;
  if not public.username_available(p_name) then
    raise exception 'Username unavailable' using errcode = '23505';
  end if;
  if exists (select 1 from snoozer.profile_revision_floor
    where owner_id = actor and last_reclaim_at > clock_timestamp() - interval '24 hours') then
    raise exception 'Replacement claim cooldown' using errcode = 'P1001';
  end if;
  insert into snoozer.profiles(owner_id, username, display_name, revision)
    values (actor, p_name, p_name, coalesce(
      (select next_revision from snoozer.profile_revision_floor where owner_id = actor), 0));
  update snoozer.profile_revision_floor set last_reclaim_at = clock_timestamp() where owner_id = actor;
end $$;

create function public.delete_profile(p_expected integer, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare deleted_revision integer;
begin
  perform 1 from auth.users where id = actor for update;
  -- Serialize against save, publish, unpublish and avatar commits.
  delete from snoozer.profiles where owner_id = actor and revision = p_expected and username = p_username
    returning revision into deleted_revision;
  if not found then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  insert into snoozer.profile_revision_floor(owner_id, next_revision) values (actor, deleted_revision + 1)
    on conflict (owner_id) do update set next_revision = excluded.next_revision;
end $$;

create function public.draft_media_scope(p_expected integer) returns uuid
language sql stable security definer set search_path = '' as $$
  select media_scope from snoozer.profiles where owner_id = snoozer.verified_user() and revision = p_expected
$$;

create function public.draft_avatar_scope(p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select media_scope from snoozer.profiles where owner_id = snoozer.verified_user() and avatar = p_avatar
$$;

create function public.published_avatar_scope(p_name text, p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.media_scope from snoozer.profiles p join snoozer.published_profiles v
    on (p.owner_id, p.published_revision) = (v.owner_id, v.revision)
  where p.username = p_name and v.avatar = p_avatar
$$;

create function public.claim_avatar_cleanup() returns jsonb
language sql security definer set search_path = '' as $$
  with candidate as (
    select scope from snoozer.avatar_cleanup
    where dead_at is null and available_at <= clock_timestamp()
    order by available_at, scope limit 1 for update skip locked
  ), leased as (
    update snoozer.avatar_cleanup j
      set lease_token = gen_random_uuid(), available_at = clock_timestamp() + interval '5 minutes'
    from candidate where j.scope = candidate.scope
    returning j.scope, j.lease_token
  )
  select to_jsonb(leased) from leased
$$;

create function public.complete_avatar_cleanup(p_scope uuid, p_lease uuid, p_success boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_success is true then
    delete from snoozer.avatar_cleanup where scope = p_scope and lease_token = p_lease;
  elsif p_success is false then
    update snoozer.avatar_cleanup set
      lease_token = null, failures = failures + 1,
      available_at = clock_timestamp() + make_interval(mins => least(60, 1 << failures)),
      dead_at = case when failures >= 7 then clock_timestamp() end
    where scope = p_scope and lease_token = p_lease;
  else
    return false;
  end if;
  return found;
end $$;

create function public.retry_avatar_cleanup() returns bigint
language sql security definer set search_path = '' as $$
  with reset as (
    update snoozer.avatar_cleanup set dead_at = null, failures = 0, available_at = clock_timestamp()
    where dead_at is not null returning 1
  )
  select count(*) from reset
$$;

revoke execute on function public.delete_profile(integer,text), public.draft_media_scope(integer),
  public.draft_avatar_scope(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_profile(integer,text), public.draft_media_scope(integer),
  public.draft_avatar_scope(uuid) to authenticated;

revoke execute on function public.published_avatar_scope(text,uuid), public.claim_avatar_cleanup(),
  public.complete_avatar_cleanup(uuid,uuid,boolean), public.retry_avatar_cleanup() from public, anon, authenticated, service_role;
grant execute on function public.published_avatar_scope(text,uuid), public.claim_avatar_cleanup(),
  public.complete_avatar_cleanup(uuid,uuid,boolean), public.retry_avatar_cleanup() to service_role;
