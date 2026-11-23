-- Feature #7: read-only, explicitly opt-in Spotify connection.
-- Secrets stay in the private Snoozer schema; no direct PostgREST grants exist.
create table if not exists snoozer.spotify_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null check (char_length(spotify_user_id) between 1 and 128),
  access_ciphertext text not null check (char_length(access_ciphertext) between 20 and 10000),
  refresh_ciphertext text not null check (char_length(refresh_ciphertext) between 20 and 10000),
  expires_at timestamptz not null,
  public_enabled boolean not null default false,
  cached_status jsonb,
  checked_at timestamptz,
  next_poll_at timestamptz not null default '-infinity'::timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table snoozer.spotify_connections enable row level security;
revoke all on snoozer.spotify_connections from public, anon, authenticated;
-- Server code reaches this table through tightly scoped, service-role-only RPCs.
create or replace function public.spotify_private_save(
 p_owner uuid, p_spotify_id text, p_access text, p_refresh text, p_expiry timestamptz
) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() <> 'service_role' or p_owner is null or p_spotify_id is null
 or length(p_spotify_id)>128 or length(p_access)<20 or length(p_refresh)<20
 or p_expiry<=now() then raise exception 'Not permitted' using errcode='42501'; end if;
 insert into snoozer.spotify_connections(owner_id,spotify_user_id,access_ciphertext,refresh_ciphertext,expires_at)
 values(p_owner,p_spotify_id,p_access,p_refresh,p_expiry)
 on conflict(owner_id) do update set
  spotify_user_id=excluded.spotify_user_id,
  access_ciphertext=excluded.access_ciphertext,
  refresh_ciphertext=excluded.refresh_ciphertext,
  expires_at=excluded.expires_at,
  public_enabled=false, cached_status=null, checked_at=null,
  next_poll_at='-infinity'::timestamptz, connected_at=now(),updated_at=now();
end $$;

create or replace function public.spotify_private_rotate(
 p_owner uuid, p_old_refresh text, p_access text, p_refresh text, p_expiry timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role() <> 'service_role' or p_owner is null or length(p_access)<20
 or length(p_refresh)<20 or p_expiry<=now()
 then raise exception 'Not permitted' using errcode='42501'; end if;
 update snoozer.spotify_connections set access_ciphertext=p_access,
 refresh_ciphertext=p_refresh, expires_at=p_expiry, updated_at=now()
 where owner_id=p_owner and refresh_ciphertext=p_old_refresh;
 return found;
end $$;

create or replace function public.spotify_private_invalidate(p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() <> 'service_role' or p_owner is null
 then raise exception 'Not permitted' using errcode='42501'; end if;
 -- Remove token data entirely on permanent revocation; the user can reconnect.
 delete from snoozer.spotify_connections where owner_id=p_owner;
end $$;

create or replace function public.spotify_private_claim(p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c snoozer.spotify_connections%rowtype; claimed boolean := false;
begin
 if auth.role() <> 'service_role' or p_name is null or
    p_name !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$'
 then raise exception 'Not permitted' using errcode='42501'; end if;
 select sc.* into c from snoozer.spotify_connections sc
 join snoozer.profiles p on p.owner_id=sc.owner_id
 where p.username=p_name and p.published_revision is not null
 and sc.public_enabled=true limit 1;
 if not found then return null; end if;
 update snoozer.spotify_connections
 set next_poll_at=now()+interval '30 seconds'
 where owner_id=c.owner_id and public_enabled=true and next_poll_at<=now()
 returning true into claimed;
 return jsonb_build_object(
  'owner_id',c.owner_id,'access_ciphertext',c.access_ciphertext,
  'refresh_ciphertext',c.refresh_ciphertext,'expires_at',c.expires_at,
  'cached_status',c.cached_status,'checked_at',c.checked_at,
  'should_poll',coalesce(claimed,false)
 );
end $$;

create or replace function public.spotify_private_cache(
 p_owner uuid, p_status jsonb, p_delay_seconds integer default 30
) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' or p_owner is null or
 p_delay_seconds not between 30 and 3600 or
 (p_status is not null and octet_length(p_status::text)>2000)
 then raise exception 'Not permitted' using errcode='42501'; end if;
 update snoozer.spotify_connections set cached_status=p_status,
 checked_at=now(),next_poll_at=now()+make_interval(secs=>p_delay_seconds)
 where owner_id=p_owner and public_enabled=true;
end $$;

create or replace function public.spotify_public_enabled(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from snoozer.profiles p
  join snoozer.spotify_connections sc on sc.owner_id=p.owner_id
  where p.username=p_name and p.published_revision is not null and sc.public_enabled=true
 );
$$;

create or replace function public.spotify_my_connection()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'Unauthorised' using errcode='42501'; end if;
 select jsonb_build_object(
  'spotify_user_id',c.spotify_user_id,'public_enabled',c.public_enabled,
  'connected_at',c.connected_at
 ) into result from snoozer.spotify_connections c where c.owner_id=actor;
 return result;
end $$;

create or replace function public.spotify_set_visibility(p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or p_enabled is null then raise exception 'Unauthorised' using errcode='42501'; end if;
 update snoozer.spotify_connections
 set public_enabled=p_enabled,cached_status=null,checked_at=null,
 next_poll_at='-infinity'::timestamptz,updated_at=now()
 where owner_id=actor;
 return found;
end $$;

create or replace function public.spotify_disconnect()
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Unauthorised' using errcode='42501'; end if;
 delete from snoozer.spotify_connections where owner_id=actor;
 return found;
end $$;

revoke all on function public.spotify_private_save(uuid,text,text,text,timestamptz),
 public.spotify_private_rotate(uuid,text,text,text,timestamptz),
 public.spotify_private_invalidate(uuid), public.spotify_private_claim(text),
 public.spotify_private_cache(uuid,jsonb,integer),
 public.spotify_public_enabled(text), public.spotify_my_connection(),
 public.spotify_set_visibility(boolean), public.spotify_disconnect()
 from public,anon,authenticated,service_role;
grant execute on function public.spotify_private_save(uuid,text,text,text,timestamptz),
 public.spotify_private_rotate(uuid,text,text,text,timestamptz),
 public.spotify_private_invalidate(uuid), public.spotify_private_claim(text),
 public.spotify_private_cache(uuid,jsonb,integer) to service_role;
grant execute on function public.spotify_public_enabled(text) to anon,authenticated;
grant execute on function public.spotify_my_connection(),
 public.spotify_set_visibility(boolean), public.spotify_disconnect() to authenticated;
