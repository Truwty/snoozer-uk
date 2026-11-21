begin;
-- Creator Ko-fi webhooks are externally reported, NOT verified settlement or refunds.
-- Never grant Snoozer entitlements from these receipts.
create table snoozer.creator_kofi_hooks(
  profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default false,
  revision integer not null default 1 check(revision>=1),
  updated_at timestamptz not null default now(),
  last_reported_at timestamptz
);
create table snoozer.creator_kofi_notifications(
  message_id uuid primary key,
  profile_id uuid not null references snoozer.creator_kofi_hooks(profile_id) on delete cascade,
  transaction_id text not null check(char_length(transaction_id) between 1 and 128),
  amount_minor integer not null check(amount_minor between 1 and 99999999),
  currency text not null check(currency in ('GBP','USD')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique(profile_id,transaction_id)
);
create index creator_kofi_notifications_recent on snoozer.creator_kofi_notifications(profile_id,occurred_at desc);
alter table snoozer.creator_kofi_hooks enable row level security;
alter table snoozer.creator_kofi_notifications enable row level security;
revoke all on snoozer.creator_kofi_hooks,snoozer.creator_kofi_notifications from public,anon,authenticated,service_role;

create function public.save_my_creator_kofi_hook(p_profile uuid,p_expected integer,p_digest text,p_enabled boolean)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); current_revision integer; next_revision integer;
begin
 if p_profile is null or p_expected is null or p_expected<0 or p_expected>2147483640 or p_enabled is null
   or (p_digest is not null and p_digest !~ '^[0-9a-f]{64}$')
 then raise exception 'Invalid Ko-fi hook settings' using errcode='22023'; end if;
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('creator-kofi:'||p_profile::text,0));
 select revision into current_revision from snoozer.creator_kofi_hooks where profile_id=p_profile for update;
 if current_revision is null then
  if p_expected<>0 or p_digest is null then raise exception 'Stale or missing token' using errcode='40001'; end if;
  insert into snoozer.creator_kofi_hooks(profile_id,owner_id,token_sha256,enabled,revision)
   values(p_profile,actor,p_digest,p_enabled,1);
  return 1;
 end if;
 if current_revision<>p_expected then raise exception 'Stale Ko-fi hook revision' using errcode='40001'; end if;
 update snoozer.creator_kofi_hooks set token_sha256=coalesce(p_digest,token_sha256),
  enabled=p_enabled,revision=revision+1,updated_at=now()
 where profile_id=p_profile and owner_id=actor returning revision into next_revision;
 if next_revision is null then raise exception 'Ko-fi hook unavailable' using errcode='42501'; end if;
 return next_revision;
end $$;

create function public.record_creator_kofi_notification(
 p_digest text,p_message uuid,p_transaction text,p_occurred timestamptz,p_amount integer,p_currency text)
returns boolean language plpgsql security definer set search_path='' as $$
declare profile uuid; existing snoozer.creator_kofi_notifications; inserted integer;
begin
 if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or p_message is null
   or p_transaction is null or char_length(p_transaction) not between 1 and 128
   or p_occurred is null or p_occurred>now()+interval '5 minutes' or p_occurred<now()-interval '365 days'
   or p_amount is null or p_amount not between 1 and 99999999 or p_currency not in ('GBP','USD')
 then raise exception 'Invalid Ko-fi notification' using errcode='22023'; end if;
 select profile_id into profile from snoozer.creator_kofi_hooks
 where token_sha256=p_digest and enabled for share;
 if profile is null then return false; end if;
 select * into existing from snoozer.creator_kofi_notifications
 where message_id=p_message or (profile_id=profile and transaction_id=p_transaction) for share;
 if found then
  if existing.profile_id<>profile or existing.message_id<>p_message or existing.transaction_id<>p_transaction
    or existing.amount_minor<>p_amount or existing.currency<>p_currency or existing.occurred_at<>p_occurred
  then raise exception 'Conflicting Ko-fi notification' using errcode='22023'; end if;
  return true;
 end if;
 if (select count(*) from snoozer.creator_kofi_notifications where profile_id=profile)>=5000
 then raise exception 'Ko-fi notification retention cap' using errcode='P1310'; end if;
 insert into snoozer.creator_kofi_notifications(message_id,profile_id,transaction_id,amount_minor,currency,occurred_at)
 values(p_message,profile,p_transaction,p_amount,p_currency,p_occurred)
 on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
  update snoozer.creator_kofi_hooks set last_reported_at=greatest(coalesce(last_reported_at,p_occurred),p_occurred) where profile_id=profile;
  return true;
 end if;
 select * into existing from snoozer.creator_kofi_notifications
 where message_id=p_message or (profile_id=profile and transaction_id=p_transaction) for share;
 if existing.profile_id<>profile or existing.message_id<>p_message or existing.transaction_id<>p_transaction
   or existing.amount_minor<>p_amount or existing.currency<>p_currency or existing.occurred_at<>p_occurred
 then raise exception 'Conflicting Ko-fi notification' using errcode='22023'; end if;
 return true;
end $$;

create function public.get_my_creator_kofi_reporting(p_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor)
 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object(
  'revision',(select revision from snoozer.creator_kofi_hooks where profile_id=p_profile),
  'enabled',coalesce((select enabled from snoozer.creator_kofi_hooks where profile_id=p_profile),false),
  'lastReportedAt',(select last_reported_at from snoozer.creator_kofi_hooks where profile_id=p_profile),
  'totals',coalesce((select jsonb_agg(jsonb_build_object('currency',currency,'count',count,'amountMinor',amount_minor) order by currency)
    from (select currency,count(*)::integer as count,sum(amount_minor)::bigint as amount_minor
       from snoozer.creator_kofi_notifications where profile_id=p_profile group by currency) totals),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',message_id,'transactionId',transaction_id,
    'currency',currency,'amountMinor',amount_minor,'occurredAt',occurred_at) order by occurred_at desc,message_id)
    from (select * from snoozer.creator_kofi_notifications where profile_id=p_profile order by occurred_at desc,message_id limit 50) recent),'[]'::jsonb)
 );
end $$;
revoke execute on function public.save_my_creator_kofi_hook(uuid,integer,text,boolean),
 public.record_creator_kofi_notification(text,uuid,text,timestamptz,integer,text),
 public.get_my_creator_kofi_reporting(uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_my_creator_kofi_hook(uuid,integer,text,boolean),
 public.get_my_creator_kofi_reporting(uuid) to authenticated;
grant execute on function public.record_creator_kofi_notification(text,uuid,text,timestamptz,integer,text)
 to service_role;
commit;
