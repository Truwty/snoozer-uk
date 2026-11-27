-- Account-owned, single-use MFA recovery codes.
-- Plaintext codes are returned once by the authenticated action; only SHA-256
-- digests are retained. A recovery code restores AAL1 only. The account owner
-- must enrol and verify a fresh TOTP factor before AAL2-protected work resumes.
create table if not exists snoozer.account_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code_hash bytea not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  constraint account_mfa_recovery_codes_hash_length check (octet_length(code_hash)=32),
  constraint account_mfa_recovery_codes_owner_hash_unique unique(owner_id,code_hash)
);

create index if not exists account_mfa_recovery_codes_owner_active_idx
  on snoozer.account_mfa_recovery_codes(owner_id,created_at)
  where used_at is null;

create table if not exists snoozer.account_mfa_recovery_attempts (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists account_mfa_recovery_attempts_owner_time_idx
  on snoozer.account_mfa_recovery_attempts(owner_id,attempted_at desc);

alter table snoozer.account_mfa_recovery_codes enable row level security;
alter table snoozer.account_mfa_recovery_attempts enable row level security;
revoke all on table snoozer.account_mfa_recovery_codes from public, anon, authenticated;
revoke all on table snoozer.account_mfa_recovery_attempts from public, anon, authenticated;

create or replace function public.replace_my_mfa_recovery_codes(p_hashes text[])
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare actor uuid := auth.uid();
begin
  if actor is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception 'Recent multi-factor verification is required' using errcode='42501';
  end if;
  if coalesce(array_length(p_hashes,1),0) <> 10
    or exists(select 1 from unnest(p_hashes) h where h !~ '^[0-9a-f]{64}$')
    or (select count(distinct h) from unnest(p_hashes) h) <> 10 then
    raise exception 'Exactly ten distinct SHA-256 recovery-code hashes are required' using errcode='22023';
  end if;

  delete from snoozer.account_mfa_recovery_codes where owner_id=actor;
  insert into snoozer.account_mfa_recovery_codes(owner_id,code_hash)
    select actor, decode(h,'hex') from unnest(p_hashes) h;
  return 10;
end
$function$;

create or replace function public.consume_my_mfa_recovery_code(p_hash text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  attempt_count integer;
begin
  if actor is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  delete from snoozer.account_mfa_recovery_attempts
    where owner_id=actor and attempted_at < now()-interval '15 minutes';
  select count(*)::integer into attempt_count
    from snoozer.account_mfa_recovery_attempts where owner_id=actor;
  if attempt_count >= 10 then return false; end if;

  insert into snoozer.account_mfa_recovery_attempts(owner_id) values(actor);
  update snoozer.account_mfa_recovery_codes
    set used_at=clock_timestamp()
    where owner_id=actor and code_hash=decode(p_hash,'hex') and used_at is null;
  return found;
end
$function$;

revoke all on function public.replace_my_mfa_recovery_codes(text[]) from public, anon;
revoke all on function public.consume_my_mfa_recovery_code(text) from public, anon;
grant execute on function public.replace_my_mfa_recovery_codes(text[]) to authenticated;
grant execute on function public.consume_my_mfa_recovery_code(text) to authenticated;
