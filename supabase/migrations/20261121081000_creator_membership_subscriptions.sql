begin;
-- Independent disabled-by-default recurring sandbox policy.
create table snoozer.creator_membership_policy(singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into snoozer.creator_membership_policy(singleton) values(true);
create table snoozer.creator_membership_reviews(
 offer_id uuid primary key references snoozer.creator_membership_offers(id) on delete cascade,
 revision integer not null check(revision>=0), expires_at timestamptz not null
);
create table snoozer.creator_membership_subscriptions(
 id uuid primary key default gen_random_uuid(),
 buyer_id uuid not null references auth.users(id) on delete restrict,
 seller_id uuid not null references auth.users(id) on delete restrict,
 profile_id uuid not null references snoozer.profiles(id) on delete restrict,
 offer_id uuid not null, offer_revision integer not null check(offer_revision>=0),
 title text not null, benefits text not null, monthly_pence integer not null check(monthly_pence between 100 and 10000),
 platform_id text not null check(platform_id ~ '^acct_[A-Za-z0-9]{1,128}$'),
 account_id text not null check(account_id ~ '^acct_[A-Za-z0-9]{1,128}$'),
 created_at timestamptz not null default now(), checkout_id text unique check(checkout_id ~ '^cs_test_[A-Za-z0-9]{1,255}$'),
 subscription_id text unique check(subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
 customer_id text check(customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
 state text not null default 'pending' check(state in('pending','active','inactive','cancelled')),
 period_end timestamptz, checked_at timestamptz, buyer_checked_at timestamptz, cancel_at_end boolean not null default false,
 holds text[] not null default '{}' check(holds <@ array['refund','dispute','fraud']::text[] and cardinality(holds)<=3),
 check(buyer_id<>seller_id and account_id<>platform_id),
 check((subscription_id is null)=(customer_id is null)),
 check(state<>'active' or (checkout_id is not null and subscription_id is not null and period_end is not null and checked_at is not null)),
 unique(buyer_id,offer_id)
);
create index creator_membership_seller_idx on snoozer.creator_membership_subscriptions(seller_id);
create table snoozer.creator_membership_receipts(
 id text not null check(id ~ '^evt_[A-Za-z0-9]{1,128}$'),
 membership_id uuid not null references snoozer.creator_membership_subscriptions(id) on delete restrict,
 event_type text not null check(char_length(event_type)<=100),
 object_id text not null check(object_id ~ '^[A-Za-z0-9_]{1,263}$'),
 occurred_at timestamptz not null, retry_count integer not null default 0 check(retry_count between 0 and 10),
 next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), processed_at timestamptz,
 primary key(id,membership_id)
);
create index creator_membership_receipt_pending on snoozer.creator_membership_receipts(membership_id) where processed_at is null;
alter table snoozer.creator_membership_policy enable row level security;
alter table snoozer.creator_membership_reviews enable row level security;
alter table snoozer.creator_membership_subscriptions enable row level security;
alter table snoozer.creator_membership_receipts enable row level security;
revoke all on snoozer.creator_membership_policy,snoozer.creator_membership_reviews,snoozer.creator_membership_subscriptions,snoozer.creator_membership_receipts from public,anon,authenticated,service_role;

create function snoozer.creator_membership_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'buyerId',s.buyer_id,'sellerId',s.seller_id,'offerId',s.offer_id,'offerRevision',s.offer_revision,
 'title',s.title,'benefits',s.benefits,'monthlyPence',s.monthly_pence,'platformId',s.platform_id,'accountId',s.account_id,
 'createdAt',s.created_at,'checkoutId',s.checkout_id,'subscriptionId',s.subscription_id,'customerId',s.customer_id,'state',s.state,
 'periodEnd',s.period_end,'checkedAt',s.checked_at,'cancelAtEnd',s.cancel_at_end,'holds',s.holds,
 'pendingReceipt',exists(select 1 from snoozer.creator_membership_receipts e where e.membership_id=s.id and e.processed_at is null))
 from snoozer.creator_membership_subscriptions s where id=p_id
$$;

create function public.review_creator_membership_offer(p_offer uuid,p_revision integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from snoozer.creator_membership_offers where id=p_offer and revision=p_revision and visible and char_length(btrim(benefits))>0)
 then raise exception 'Offer revision unavailable' using errcode='22023'; end if;
 insert into snoozer.creator_membership_reviews(offer_id,revision,expires_at) values(p_offer,p_revision,now()+interval '24 hours')
 on conflict(offer_id) do update set revision=excluded.revision,expires_at=excluded.expires_at;
 return true;
end $$;

create function public.get_creator_membership_checkout_offers(p_name text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(m.id order by m.id),'[]'::jsonb)
 from snoozer.creator_membership_offers m join snoozer.creator_membership_reviews r on r.offer_id=m.id and r.revision=m.revision and r.expires_at>now()
 join snoozer.profiles p on p.id=m.profile_id and p.owner_id=m.owner_id
 where p.username::text=p_name and m.visible and exists(select 1 from snoozer.creator_membership_policy where enabled)
 and jsonb_array_length(coalesce(public.get_creator_sandbox_store(p_name)->'items','[]'::jsonb))>0
$$;

create function public.reserve_creator_membership(p_buyer uuid,p_offer uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m snoozer.creator_membership_offers; seller snoozer.creator_sandbox_accounts; key uuid; name text;
begin
 select * into m from snoozer.creator_membership_offers where id=p_offer;
 if not found then raise exception 'Membership unavailable' using errcode='P1227'; end if;
 perform 1 from auth.users where id in(p_buyer,m.owner_id) order by id for update;
 if p_buyer is null or p_buyer=m.owner_id or not exists(select 1 from auth.users where id=p_buyer and email_confirmed_at is not null)
 or not exists(select 1 from auth.users where id=m.owner_id and email_confirmed_at is not null)
 then raise exception 'Independent verified buyer required' using errcode='42501'; end if;
 select * into m from snoozer.creator_membership_offers where id=p_offer for update;
 if not found then raise exception 'Membership unavailable' using errcode='P1227'; end if;
 select p.username::text into name from snoozer.profiles p where p.id=m.profile_id and p.owner_id=m.owner_id;
 select * into seller from snoozer.creator_sandbox_accounts where owner_id=m.owner_id for update;
 if seller.account_id is null or not seller.ready or seller.checked_at<=now()-interval '5 minutes'
 or not (public.get_creator_membership_checkout_offers(name) @> jsonb_build_array(m.id))
 then raise exception 'Membership unavailable' using errcode='P1227'; end if;
 select id into key from snoozer.creator_membership_subscriptions where buyer_id=p_buyer and offer_id=p_offer;
 if found then return snoozer.creator_membership_json(key); end if;
 if (select count(*) from snoozer.creator_membership_subscriptions where buyer_id=p_buyer)>=10
 or (select count(*) from snoozer.creator_membership_subscriptions where seller_id=m.owner_id)>=100
 then raise exception 'Membership sandbox limit' using errcode='P1227'; end if;
 insert into snoozer.creator_membership_subscriptions(buyer_id,seller_id,profile_id,offer_id,offer_revision,title,benefits,monthly_pence,platform_id,account_id)
 values(p_buyer,m.owner_id,m.profile_id,m.id,m.revision,m.title,m.benefits,m.monthly_pence,seller.platform_id,seller.account_id) returning id into key;
 return snoozer.creator_membership_json(key);
end $$;

create function public.get_creator_membership_subscription(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$ select snoozer.creator_membership_json(p_id) $$;
create function public.find_creator_membership_subscription(p_account text,p_subscription text) returns jsonb
language sql stable security definer set search_path='' as $$
 select snoozer.creator_membership_json(id) from snoozer.creator_membership_subscriptions where account_id=p_account and subscription_id=p_subscription
$$;
create function public.bind_creator_membership_checkout(p_id uuid,p_account text,p_checkout text,p_subscription text,p_customer text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update snoozer.creator_membership_subscriptions set checkout_id=coalesce(checkout_id,p_checkout),subscription_id=coalesce(subscription_id,p_subscription),customer_id=coalesce(customer_id,p_customer)
 where id=p_id and account_id=p_account and p_checkout is not null and (checkout_id is null or checkout_id=p_checkout)
 and ((p_subscription is null and p_customer is null) or (p_subscription is not null and p_customer is not null and (subscription_id is null or subscription_id=p_subscription) and (customer_id is null or customer_id=p_customer)));
 return found;
end $$;
create function public.stage_creator_membership_receipt(p_id uuid,p_account text,p_event text,p_type text,p_object text,p_occurred timestamptz,p_hold text) returns boolean
language plpgsql security definer set search_path='' as $$
declare e snoozer.creator_membership_receipts;
begin
 perform 1 from snoozer.creator_membership_subscriptions where id=p_id and account_id=p_account for update;
 if not found then raise exception 'Membership unavailable' using errcode='42501'; end if;
 if p_hold is not null and p_hold not in('refund','dispute','fraud') then raise exception 'Invalid hold' using errcode='22023'; end if;
 insert into snoozer.creator_membership_receipts(id,membership_id,event_type,object_id,occurred_at) values(p_event,p_id,p_type,p_object,p_occurred) on conflict(id,membership_id) do nothing;
 select * into e from snoozer.creator_membership_receipts where id=p_event and membership_id=p_id;
 if e.membership_id<>p_id or e.event_type<>p_type or e.object_id<>p_object or e.occurred_at<>p_occurred then raise exception 'Receipt mismatch' using errcode='22023'; end if;
 if p_hold is not null then
  update snoozer.creator_membership_subscriptions set holds=array(select distinct x from unnest(holds||array[p_hold]) x order by x) where id=p_id;
 end if;
 return e.processed_at is null;
end $$;
create function public.apply_creator_membership_proof(p_id uuid,p_account text,p_subscription text,p_checked timestamptz,p_state text,p_end timestamptz,p_cancel boolean,p_holds text[],p_event text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s snoozer.creator_membership_subscriptions;
begin
 select * into s from snoozer.creator_membership_subscriptions where id=p_id and account_id=p_account and subscription_id=p_subscription for update;
 if not found or p_checked is null or p_checked<now()-interval '2 minutes' or p_checked>now()+interval '5 seconds'
 or p_state is null or p_state not in('active','inactive','cancelled') or p_cancel is null
 or p_holds is null or not(p_holds <@ array['refund','dispute','fraud']::text[]) or cardinality(p_holds)>3
 or (p_state='active' and (p_end is null or p_end<=now() or p_end>now()+interval '32 days'))
 then raise exception 'Invalid membership proof' using errcode='22023'; end if;
 if p_event is not null and not exists(select 1 from snoozer.creator_membership_receipts where id=p_event and membership_id=p_id)
 then raise exception 'Receipt mismatch' using errcode='22023'; end if;
 update snoozer.creator_membership_subscriptions set holds=array(select distinct x from unnest(holds||p_holds) x order by x),
 state=case when checked_at is null or checked_at<=p_checked then p_state else state end,
 period_end=case when checked_at is null or checked_at<=p_checked then p_end else period_end end,
 cancel_at_end=case when checked_at is null or checked_at<=p_checked then p_cancel else cancel_at_end end,
 checked_at=greatest(checked_at,p_checked) where id=p_id;
 if p_event is not null then update snoozer.creator_membership_receipts set processed_at=coalesce(processed_at,now()) where id=p_event and membership_id=p_id; end if;
 return snoozer.creator_membership_json(p_id);
end $$;
create function public.expire_creator_membership_checkout(p_id uuid,p_account text,p_checkout text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update snoozer.creator_membership_subscriptions set state='cancelled' where id=p_id and account_id=p_account and checkout_id=p_checkout and subscription_id is null and state in('pending','cancelled');
 return found;
end $$;
create function public.claim_my_creator_membership_check(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 update snoozer.creator_membership_subscriptions set buyer_checked_at=now() where id=p_id and buyer_id=actor and (buyer_checked_at is null or buyer_checked_at<=now()-interval '10 seconds');
 return found;
end $$;
create function public.finish_creator_membership_checkout_receipt(p_id uuid,p_event text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update snoozer.creator_membership_receipts set processed_at=coalesce(processed_at,now()) where id=p_event and membership_id=p_id and event_type like 'checkout.session.%';
 return found;
end $$;
create function public.list_creator_membership_retries(p_platform text,p_limit integer,p_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_limit is null or p_limit not between 1 and 10 then raise exception 'Invalid limit' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id,'type',event_type,'objectId',object_id,'occurredAt',occurred_at))
 from (select distinct on(r.id) r.id,s.account_id,r.event_type,r.object_id,r.occurred_at
 from snoozer.creator_membership_receipts r join snoozer.creator_membership_subscriptions s on s.id=r.membership_id
 where s.platform_id=p_platform and r.processed_at is null and r.retry_count<10 and r.next_attempt_at<=now() and (p_id is null or r.id=p_id)
 order by r.id,r.occurred_at limit p_limit) rows),'[]'::jsonb);
end $$;
create function public.claim_creator_membership_retry(p_platform text,p_id text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update snoozer.creator_membership_receipts r set retry_count=retry_count+1,next_attempt_at=now()+make_interval(mins=>least(720,5*(2^retry_count)::integer))
 from snoozer.creator_membership_subscriptions s where s.id=r.membership_id and s.platform_id=p_platform and r.id=p_id
 and r.processed_at is null and r.retry_count<10 and r.next_attempt_at<=now();
 return found;
end $$;
create function public.list_my_creator_memberships() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'monthlyPence',monthly_pence,'state',state,'periodEnd',period_end,
 'cancelAtEnd',cancel_at_end,'canCancel',subscription_id is not null and state<>'cancelled' and not cancel_at_end,'held',cardinality(holds)>0,'pendingReceipt',exists(select 1 from snoozer.creator_membership_receipts e where e.membership_id=s.id and e.processed_at is null)) order by created_at desc,id)
 from snoozer.creator_membership_subscriptions s where buyer_id=actor),'[]'::jsonb);
end $$;
create function public.owns_my_creator_membership(p_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin return exists(select 1 from snoozer.creator_membership_subscriptions where id=p_id and buyer_id=actor); end $$;
revoke execute on function snoozer.creator_membership_json(uuid),public.review_creator_membership_offer(uuid,integer),public.get_creator_membership_checkout_offers(text),public.reserve_creator_membership(uuid,uuid),public.get_creator_membership_subscription(uuid),public.find_creator_membership_subscription(text,text),public.bind_creator_membership_checkout(uuid,text,text,text,text),public.stage_creator_membership_receipt(uuid,text,text,text,text,timestamptz,text),public.apply_creator_membership_proof(uuid,text,text,timestamptz,text,timestamptz,boolean,text[],text),public.expire_creator_membership_checkout(uuid,text,text),public.list_my_creator_memberships(),public.owns_my_creator_membership(uuid),public.claim_my_creator_membership_check(uuid),public.finish_creator_membership_checkout_receipt(uuid,text),public.list_creator_membership_retries(text,integer,text),public.claim_creator_membership_retry(text,text) from public,anon,authenticated,service_role;
grant execute on function public.review_creator_membership_offer(uuid,integer),public.reserve_creator_membership(uuid,uuid),public.get_creator_membership_subscription(uuid),public.find_creator_membership_subscription(text,text),public.bind_creator_membership_checkout(uuid,text,text,text,text),public.stage_creator_membership_receipt(uuid,text,text,text,text,timestamptz,text),public.apply_creator_membership_proof(uuid,text,text,timestamptz,text,timestamptz,boolean,text[],text),public.expire_creator_membership_checkout(uuid,text,text),public.finish_creator_membership_checkout_receipt(uuid,text),public.list_creator_membership_retries(text,integer,text),public.claim_creator_membership_retry(text,text) to service_role;
grant execute on function public.get_creator_membership_checkout_offers(text) to anon,authenticated;
grant execute on function public.list_my_creator_memberships(),public.owns_my_creator_membership(uuid),public.claim_my_creator_membership_check(uuid) to authenticated;
commit;
