begin;
create table snoozer.referral_codes (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 code uuid not null unique default gen_random_uuid(),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table snoozer.referral_attributions (
 member_id uuid primary key references auth.users(id) on delete cascade,
 referrer_id uuid references auth.users(id) on delete set null,
 accepted_at timestamptz not null default now(),
 withdrawn_at timestamptz
);
create index referral_attributions_owner on snoozer.referral_attributions(referrer_id,accepted_at) where withdrawn_at is null;
alter table snoozer.referral_codes enable row level security;
alter table snoozer.referral_attributions enable row level security;
revoke all on snoozer.referral_codes,snoozer.referral_attributions from public,anon,authenticated,service_role;

create function public.set_my_referral_enabled(p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 if p_enabled is null then raise exception 'Choose a referral setting' using errcode='22023'; end if;
 if p_enabled and not exists(select 1 from snoozer.profiles where owner_id=actor and published_revision is not null) then
  raise exception 'Publish a profile before enabling referrals' using errcode='22023';
 end if;
 insert into snoozer.referral_codes(owner_id,enabled) values(actor,p_enabled)
 on conflict(owner_id) do update set enabled=excluded.enabled;
end $$;

create function public.accept_my_referral() returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare candidate snoozer.referral_codes;
declare account_created timestamptz;
declare metadata jsonb;
begin
 -- The identity row serializes acceptance and withdrawal across tabs.
 select created_at,raw_user_meta_data into account_created,metadata from auth.users where id=actor for update;
 if exists(select 1 from snoozer.referral_attributions where member_id=actor) then return 'already_recorded'; end if;
 if metadata->'snoozer_referral_consent' is distinct from 'true'::jsonb
  or coalesce(metadata->>'snoozer_referral','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or account_created is null or account_created<now()-interval '24 hours' then return 'ineligible'; end if;
 select * into candidate from snoozer.referral_codes where code=(metadata->>'snoozer_referral')::uuid and enabled for share;
 if not found or candidate.owner_id=actor or candidate.created_at>account_created
  or not exists(select 1 from auth.users where id=candidate.owner_id and email_confirmed_at is not null)
  or not exists(select 1 from snoozer.profiles where owner_id=candidate.owner_id and published_revision is not null) then return 'ineligible'; end if;
 -- Editable Auth metadata is only a consented attribution claim, never authority for rewards.
 insert into snoozer.referral_attributions(member_id,referrer_id) values(actor,candidate.owner_id);
 return 'accepted';
end $$;

create function public.withdraw_my_referral() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 perform 1 from auth.users where id=actor for update;
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-array['snoozer_referral','snoozer_referral_consent'] where id=actor;
 -- Keep an account-scoped exclusion marker to prevent re-attribution after withdrawal.
 insert into snoozer.referral_attributions(member_id,withdrawn_at) values(actor,now())
 on conflict(member_id) do update set referrer_id=null,withdrawn_at=coalesce(referral_attributions.withdrawn_at,now());
end $$;

create function public.get_my_growth() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare verified integer;
declare claimed integer;
declare published integer;
begin
 select count(*),count(*) filter(where exists(select 1 from snoozer.profiles p where p.owner_id=a.member_id)),
  count(*) filter(where exists(select 1 from snoozer.profiles p where p.owner_id=a.member_id and p.published_revision is not null))
 into verified,claimed,published from snoozer.referral_attributions a
 join auth.users u on u.id=a.member_id and u.email_confirmed_at is not null
 where a.referrer_id=actor and a.withdrawn_at is null and a.accepted_at>=now()-interval '90 days';
 return jsonb_build_object(
  'code',(select code from snoozer.referral_codes where owner_id=actor),
  'enabled',coalesce((select enabled from snoozer.referral_codes where owner_id=actor),false),
  'canEnable',exists(select 1 from snoozer.profiles where owner_id=actor and published_revision is not null),
  'verified',verified,'claimed',case when verified>=5 then claimed end,'published',case when verified>=5 then published end,
  'attribution',coalesce((select case when withdrawn_at is not null then 'withdrawn' when referrer_id is null then 'removed' else 'accepted' end from snoozer.referral_attributions where member_id=actor),'none'));
end $$;

revoke execute on function public.set_my_referral_enabled(boolean),public.accept_my_referral(),public.withdraw_my_referral(),public.get_my_growth() from public,anon,authenticated,service_role;
grant execute on function public.set_my_referral_enabled(boolean),public.accept_my_referral(),public.withdraw_my_referral(),public.get_my_growth() to authenticated;
commit;
