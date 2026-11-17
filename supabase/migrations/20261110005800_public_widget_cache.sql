-- Noncritical public provider metadata. No Snoozer account/visitor identifiers or tokens.
create table snoozer.public_widget_limits (
  provider text primary key check(provider in ('github','discord')),
  window_start timestamptz not null,
  used integer not null default 0 check(used between 0 and 40),
  next_allowed timestamptz not null default now(),
  blocked_until timestamptz not null default now()
);
create table snoozer.public_widget_cache (
  provider text not null check(provider in ('github','discord')),
  resource text not null check(char_length(resource) between 1 and 150),
  payload jsonb check(payload is null or (jsonb_typeof(payload)='object' and octet_length(payload::text)<=8192)),
  expires_at timestamptz not null default now(),
  lease uuid not null,
  lease_until timestamptz not null,
  primary key(provider,resource)
);
create index public_widget_cache_expiry on snoozer.public_widget_cache(provider,expires_at);
alter table snoozer.public_widget_limits enable row level security;
alter table snoozer.public_widget_cache enable row level security;
revoke all on snoozer.public_widget_limits,snoozer.public_widget_cache from public,anon,authenticated,service_role;

create function public.claim_public_widget(p_provider text,p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cached snoozer.public_widget_cache; limits snoozer.public_widget_limits;
  token uuid; window_now timestamptz := date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_provider is null or p_provider not in ('github','discord') or p_resource is null
    or char_length(p_resource) not between 1 and 150
    or (p_provider='github' and (p_resource !~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$' or split_part(p_resource,'/',2) in ('.','..')))
    or (p_provider='discord' and p_resource !~ '^(i:[A-Za-z0-9_-]{2,64}|g:[1-9][0-9]{16,19})$') then
    raise exception 'Invalid widget resource' using errcode='22023';
  end if;
  select * into cached from snoozer.public_widget_cache where provider=p_provider and resource=p_resource;
  if found and cached.expires_at>now() then
    return case when cached.payload is null then jsonb_build_object('state','unavailable')
      else jsonb_build_object('state','cached','payload',cached.payload) end;
  end if;

  insert into snoozer.public_widget_limits(provider,window_start) values(p_provider,window_now) on conflict do nothing;
  select * into limits from snoozer.public_widget_limits where provider=p_provider for update;
  -- All writes take the provider lock before any cache row lock.
  select * into cached from snoozer.public_widget_cache where provider=p_provider and resource=p_resource for update;
  if found then
    if cached.expires_at>now() then
      return case when cached.payload is null then jsonb_build_object('state','unavailable')
        else jsonb_build_object('state','cached','payload',cached.payload) end;
    end if;
    if cached.lease_until>now() then return jsonb_build_object('state','pending','retry_after',30); end if;
  end if;
  if limits.window_start<>window_now then
    update snoozer.public_widget_limits set window_start=window_now,used=0 where provider=p_provider returning * into limits;
  end if;
  if limits.blocked_until>now() or limits.used>=40 or limits.next_allowed>now() then
    return jsonb_build_object('state','limited','retry_after',
      greatest(1,ceil(extract(epoch from (
        greatest(limits.blocked_until,limits.next_allowed,case when limits.used>=40 then window_now+interval '1 hour' else now() end)-now()
      )))::integer));
  end if;
  update snoozer.public_widget_limits set used=used+1,next_allowed=now()+interval '1 second' where provider=p_provider;
  token := gen_random_uuid();
  insert into snoozer.public_widget_cache(provider,resource,lease,lease_until,expires_at)
    values(p_provider,p_resource,token,now()+interval '30 seconds',now())
    on conflict(provider,resource) do update set lease=excluded.lease,lease_until=excluded.lease_until;
  delete from snoozer.public_widget_cache where provider=p_provider and resource in (
    select resource from snoozer.public_widget_cache where provider=p_provider
      and expires_at<now()-interval '7 days' and lease_until<now() limit 100
  );
  return jsonb_build_object('state','refresh','lease',token);
end;
$$;

create function public.complete_public_widget(p_provider text,p_resource text,p_lease uuid,p_payload jsonb,p_retry_after integer default 0)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_retry_after is null or p_retry_after not between 0 and 86400
    or (p_payload is not null and (jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192)) then
    raise exception 'Invalid widget completion' using errcode='22023';
  end if;
  perform 1 from snoozer.public_widget_limits where provider=p_provider for update;
  if not found then return false; end if;
  update snoozer.public_widget_cache set payload=p_payload,
    expires_at=now()+case when p_payload is null then interval '5 minutes' else interval '1 hour' end,
    lease_until=now()
    where provider=p_provider and resource=p_resource and lease=p_lease and lease_until>now();
  if not found then return false; end if;
  if p_retry_after>0 then
    update snoozer.public_widget_limits set blocked_until=greatest(blocked_until,now()+make_interval(secs=>p_retry_after))
      where provider=p_provider;
  end if;
  return true;
end;
$$;

revoke execute on function public.claim_public_widget(text,text),
  public.complete_public_widget(text,text,uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_public_widget(text,text),
  public.complete_public_widget(text,text,uuid,jsonb,integer) to service_role;
