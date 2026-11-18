begin;
create table snoozer.creator_sandbox_accounts (
 owner_id uuid primary key references auth.users(id) on delete restrict,
 id uuid not null unique default gen_random_uuid(),
 platform_id text not null check(platform_id ~ '^acct_[A-Za-z0-9]{1,128}$'),
 account_id text unique check(account_id ~ '^acct_[A-Za-z0-9]{1,128}$' and account_id<>platform_id),
 country text not null check(country='GB'),
 created_at timestamptz not null default now(),
 ready boolean not null default false, checked_at timestamptz,
 check_lease uuid, check_until timestamptz, retry_after timestamptz not null default '-infinity'
);
alter table snoozer.creator_sandbox_accounts enable row level security;
revoke all on snoozer.creator_sandbox_accounts from public,anon,authenticated,service_role;

create function public.get_my_creator_sandbox_account() returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select jsonb_build_object('id',m.id,'platformId',m.platform_id,'accountId',m.account_id,'country',m.country,
  'createdAt',m.created_at,'ready',m.ready,'checkedAt',m.checked_at)
 from actor join snoozer.creator_sandbox_accounts m on m.owner_id=actor.id
$$;

create function public.reserve_creator_sandbox_account(p_owner uuid,p_platform text,p_country text) returns jsonb language plpgsql security definer set search_path='' as $$
declare merchant snoozer.creator_sandbox_accounts;
begin
 if p_platform is null or p_platform !~ '^acct_[A-Za-z0-9]{1,128}$' or p_country is distinct from 'GB' then raise exception 'Invalid sandbox configuration' using errcode='22023'; end if;
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found or not exists(select 1 from snoozer.profiles where owner_id=p_owner) then raise exception 'Verified profile owner required' using errcode='42501'; end if;
 insert into snoozer.creator_sandbox_accounts(owner_id,platform_id,country) values(p_owner,p_platform,p_country) on conflict(owner_id) do nothing;
 select * into merchant from snoozer.creator_sandbox_accounts where owner_id=p_owner for update;
 if merchant.platform_id<>p_platform or merchant.country<>p_country then raise exception 'Sandbox binding changed' using errcode='40001'; end if;
 -- Do not recreate an uncertain provider account after the conservative idempotency window.
 if merchant.account_id is null and merchant.created_at<now()-interval '23 hours' then raise exception 'Account creation requires reconciliation' using errcode='P1210'; end if;
 return jsonb_build_object('id',merchant.id,'platformId',merchant.platform_id,'accountId',merchant.account_id,'country',merchant.country,
  'createdAt',merchant.created_at,'ready',merchant.ready,'checkedAt',merchant.checked_at);
end $$;

create function public.bind_creator_sandbox_account(p_owner uuid,p_operation uuid,p_account text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_account is null or p_account !~ '^acct_[A-Za-z0-9]{1,128}$' then raise exception 'Invalid account' using errcode='22023'; end if;
 perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
 if not found then return false; end if;
 update snoozer.creator_sandbox_accounts set account_id=p_account where owner_id=p_owner and id=p_operation and p_account<>platform_id
  and (account_id=p_account or (account_id is null and created_at>=now()-interval '23 hours'));
 return found;
end $$;

create function public.claim_creator_sandbox_check(p_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 update snoozer.creator_sandbox_accounts set ready=false,check_lease=token,check_until=now()+interval '30 seconds',retry_after=now()+interval '1 minute'
  where owner_id=p_owner and account_id is not null and retry_after<=now() and coalesce(check_until,'-infinity')<=now();
 if found then return token; end if;
 return null;
end $$;

create function public.complete_creator_sandbox_check(p_owner uuid,p_account text,p_lease uuid,p_ready boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_ready is null then raise exception 'Invalid account state' using errcode='22023'; end if;
 update snoozer.creator_sandbox_accounts set ready=p_ready,checked_at=now(),check_lease=null,check_until=null
  where owner_id=p_owner and account_id=p_account and check_lease=p_lease and check_until>now();
 return found;
end $$;

revoke execute on function public.get_my_creator_sandbox_account(),public.reserve_creator_sandbox_account(uuid,text,text),public.bind_creator_sandbox_account(uuid,uuid,text),public.claim_creator_sandbox_check(uuid),public.complete_creator_sandbox_check(uuid,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_my_creator_sandbox_account() to authenticated;
grant execute on function public.reserve_creator_sandbox_account(uuid,text,text),public.bind_creator_sandbox_account(uuid,uuid,text),public.claim_creator_sandbox_check(uuid),public.complete_creator_sandbox_check(uuid,text,uuid,boolean) to service_role;
commit;
