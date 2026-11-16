create table snoozer.gift_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique check (octet_length(code_hash) = 32),
  plan text not null check (plan <> 'free'),
  plan_version integer not null,
  duration_days integer not null check (duration_days between 1 and 366),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > issued_at),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  foreign key (plan,plan_version) references snoozer.plan_versions(plan,version)
);
alter table snoozer.gift_codes enable row level security;
revoke all on snoozer.gift_codes from public, anon, authenticated, service_role;

create function public.issue_gift_code(
  p_plan text, p_version integer, p_duration_days integer, p_redeem_by timestamptz
) returns table(gift_id uuid, code text) language plpgsql security definer set search_path = '' as $$
declare
  token text := replace(gen_random_uuid()::text, '-', '');
begin
  insert into snoozer.gift_codes(code_hash,plan,plan_version,duration_days,expires_at)
  values (sha256(convert_to(token,'UTF8')),p_plan,p_version,p_duration_days,p_redeem_by)
  returning id into gift_id;
  code := token;
  return next;
end
$$;

create function public.redeem_gift_code(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  token text := lower(btrim(p_code));
  gift snoozer.gift_codes;
  redeemed timestamptz;
begin
  if token is null or token !~ '^[a-f0-9]{32}$' then return false; end if;
  select * into gift from snoozer.gift_codes
  where code_hash = sha256(convert_to(token,'UTF8')) for update;
  if not found then return false; end if;
  redeemed := clock_timestamp();
  if gift.redeemed_at is not null or gift.revoked_at is not null or gift.expires_at <= redeemed then
    return false;
  end if;
  update snoozer.gift_codes set redeemed_at = redeemed where id = gift.id;
  insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
  values (actor,gift.plan,gift.plan_version,'gift',gift.id::text,redeemed,redeemed+gift.duration_days*interval '24 hours');
  return true;
end
$$;

create function public.revoke_gift_code(p_gift uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update snoozer.gift_codes set revoked_at = clock_timestamp()
  where id = p_gift and revoked_at is null;
  if not found then return false; end if;

  update snoozer.entitlement_grants set revoked_at = clock_timestamp()
  where source = 'gift' and source_ref = p_gift::text and revoked_at is null;
  return true;
end
$$;

revoke execute on function public.revoke_gift_code(uuid) from public, anon, authenticated, service_role;
grant execute on function public.revoke_gift_code(uuid) to service_role;
revoke execute on function public.issue_gift_code(text,integer,integer,timestamptz),
  public.redeem_gift_code(text) from public, anon, authenticated, service_role;
grant execute on function public.issue_gift_code(text,integer,integer,timestamptz) to service_role;
grant execute on function public.redeem_gift_code(text) to authenticated;
