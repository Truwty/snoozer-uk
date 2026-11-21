-- Premium belongs only to Snoozer (not Stripe Connect). Safe additive foundation.
-- This is deliberately OFF until the owner confirms real prices, tax and legal readiness.
create table snoozer.premium_live_policy (
  singleton boolean primary key default true check (singleton),
  checkout_enabled boolean not null default false,
  tax_reviewed boolean not null default false,
  legal_reviewed boolean not null default false,
  reviewed_at timestamptz
);
insert into snoozer.premium_live_policy(singleton) values(true);

create table snoozer.premium_live_prices (
  price_id text primary key check(price_id ~ '^price_[A-Za-z0-9]{1,128}$'),
  plan text not null check(plan in ('plus','pro','studio')),
  plan_version integer not null,
  billing_interval text not null check(billing_interval in ('month','year')),
  currency text not null default 'gbp' check(currency='gbp'),
  unit_amount integer not null check(unit_amount between 50 and 100000),
  retired_at timestamptz,
  foreign key(plan,plan_version) references snoozer.plan_versions(plan,version)
);
create unique index premium_live_current_plan_price on snoozer.premium_live_prices(plan,billing_interval)
  where retired_at is null;

create table snoozer.premium_live_customers (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text unique check(customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
  created_at timestamptz not null default now()
);

create table snoozer.premium_live_checkouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null references snoozer.premium_live_prices(price_id),
  session_id text unique check(session_id ~ '^cs_live_[A-Za-z0-9]{1,128}$'),
  subscription_id text unique check(subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  status text not null default 'reserved' check(status in ('reserved','pending','bound','expired','ended')),
  created_at timestamptz not null default date_trunc('second',now()),
  expires_at timestamptz not null default (date_trunc('second',now()) + interval '60 minutes'),
  reconciliation_revision integer not null default 0,
  last_invoice text check(last_invoice is null or last_invoice ~ '^in_[A-Za-z0-9]{1,128}$'),
  last_status text check(last_status is null or last_status in
    ('active','trialing','canceled','incomplete','incomplete_expired','past_due','paused','unpaid')),
  last_checked_at timestamptz,
  check(expires_at > created_at)
);
create unique index premium_live_one_nonterminal_checkout_per_owner
  on snoozer.premium_live_checkouts(owner_id)
  where status in ('reserved','pending','bound');
create index premium_live_checkouts_subscription on snoozer.premium_live_checkouts(subscription_id)
  where subscription_id is not null;

create table snoozer.premium_live_receipts (
  event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]{1,128}$'),
  event_type text not null,
  object_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index premium_live_receipts_unprocessed on snoozer.premium_live_receipts(received_at)
  where processed_at is null;

-- A provider-confirmed refund or fraud concern holds its invoice until a human-approved
-- resolution procedure is deliberately added. Never infer a dispute reversal from silence.
create table snoozer.premium_live_invoice_holds (
  invoice_id text primary key check(invoice_id ~ '^in_[A-Za-z0-9]{1,128}$'),
  subscription_id text not null check(subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  customer_id text not null check(customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
  reason text not null check(reason in ('refund','dispute','fraud')),
  event_id text references snoozer.premium_live_receipts(event_id),
  created_at timestamptz not null default now()
);

alter table snoozer.premium_live_policy enable row level security;
alter table snoozer.premium_live_prices enable row level security;
alter table snoozer.premium_live_customers enable row level security;
alter table snoozer.premium_live_checkouts enable row level security;
alter table snoozer.premium_live_receipts enable row level security;
alter table snoozer.premium_live_invoice_holds enable row level security;
revoke all on snoozer.premium_live_policy,snoozer.premium_live_prices,
  snoozer.premium_live_customers,snoozer.premium_live_checkouts,
  snoozer.premium_live_receipts,snoozer.premium_live_invoice_holds
  from public,anon,authenticated,service_role;

-- Service-only catalogue query. No customer can modify a price or activation flag.
create function public.list_premium_live_offers()
returns table(price_id text,plan text,plan_version integer,billing_interval text,currency text,unit_amount integer)
language sql stable security definer set search_path = '' as $$
  select p.price_id,p.plan,p.plan_version,p.billing_interval,p.currency,p.unit_amount
  from snoozer.premium_live_prices p
  join snoozer.premium_live_policy k on k.singleton=true
  where k.checkout_enabled and k.tax_reviewed and k.legal_reviewed
    and p.retired_at is null order by p.unit_amount,p.price_id
$$;

create function public.prepare_premium_live_checkout(p_owner uuid,p_price text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  offer snoozer.premium_live_prices;
  attempt snoozer.premium_live_checkouts;
  cid text;
begin
  -- Avoid a second session for the same verified account, including racing requests.
  perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
  if not found then raise exception 'Verified account required' using errcode='42501'; end if;
  if not exists(select 1 from snoozer.premium_live_policy where singleton
    and checkout_enabled and tax_reviewed and legal_reviewed) then return null; end if;
  select * into offer from snoozer.premium_live_prices
    where price_id=p_price and retired_at is null;
  if not found then return null; end if;
  select customer_id into cid from snoozer.premium_live_customers where owner_id=p_owner;
  select * into attempt from snoozer.premium_live_checkouts
    where owner_id=p_owner and status in ('reserved','pending','bound') for update;
  if found then
    if attempt.status='bound' or attempt.price_id<>p_price
      or attempt.expires_at<=now() then return null; end if;
  else
    insert into snoozer.premium_live_checkouts(owner_id,price_id)
    values(p_owner,p_price) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'priceId',attempt.price_id,
    'amount',offer.unit_amount,'interval',offer.billing_interval,
    'customerId',cid,'sessionId',attempt.session_id,
    'expires',extract(epoch from attempt.expires_at)::bigint);
end $$;

create function public.bind_premium_live_customer(p_owner uuid,p_attempt uuid,p_customer text)
returns boolean language plpgsql security definer set search_path='' as $$
declare cid text;
begin
  if p_customer !~ '^cus_[A-Za-z0-9]{1,128}$'
    or not exists(select 1 from snoozer.premium_live_checkouts
      where id=p_attempt and owner_id=p_owner and status in ('reserved','pending')) then return false; end if;
  insert into snoozer.premium_live_customers(owner_id,customer_id)
    values(p_owner,p_customer) on conflict(owner_id) do nothing;
  select customer_id into cid from snoozer.premium_live_customers where owner_id=p_owner;
  return cid=p_customer;
end $$;

create function public.bind_premium_live_session(p_owner uuid,p_attempt uuid,p_customer text,p_session text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_session !~ '^cs_live_[A-Za-z0-9]{1,128}$' then return false; end if;
  update snoozer.premium_live_checkouts a
    set session_id=coalesce(a.session_id,p_session),status='pending'
    where id=p_attempt and owner_id=p_owner and status in ('reserved','pending')
    and (session_id is null or session_id=p_session)
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end $$;

-- A completed Stripe Checkout must be read back from Stripe and checked for
-- owner, customer, session, mode and paid subscription before calling this.
create function public.bind_premium_live_subscription(p_owner uuid,p_customer text,p_session text,p_subscription text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_subscription !~ '^sub_[A-Za-z0-9]{1,128}$' then return false; end if;
  update snoozer.premium_live_checkouts a set
    subscription_id=coalesce(a.subscription_id,p_subscription), status='bound'
  where a.owner_id=p_owner and a.session_id=p_session
    and a.status in ('pending','bound')
    and (a.subscription_id is null or a.subscription_id=p_subscription)
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end $$;

create function public.record_premium_live_receipt(p_id text,p_type text,p_object text,p_occurred timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v snoozer.premium_live_receipts;
begin
  insert into snoozer.premium_live_receipts(event_id,event_type,object_id,occurred_at)
  values(p_id,p_type,p_object,p_occurred) on conflict(event_id) do nothing;
  select * into strict v from snoozer.premium_live_receipts where event_id=p_id;
  if v.event_type<>p_type or v.object_id<>p_object or v.occurred_at<>p_occurred then
    raise exception 'Stripe receipt identity mismatch' using errcode='23514';
  end if;
  return v.processed_at is null;
end $$;

create function public.finish_premium_live_receipt(p_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update snoozer.premium_live_receipts set processed_at=now()
  where event_id=p_id and processed_at is null;
  return found or exists(select 1 from snoozer.premium_live_receipts where event_id=p_id and processed_at is not null);
end $$;

create function public.start_premium_live_reconciliation(p_subscription text)
returns table(owner_id uuid,customer_id text,price_id text,revision integer)
language sql security definer set search_path='' as $$
  update snoozer.premium_live_checkouts a
    set reconciliation_revision=reconciliation_revision+1
    from snoozer.premium_live_customers c
    where a.subscription_id=p_subscription and a.owner_id=c.owner_id and a.status='bound'
    returning a.owner_id,c.customer_id,a.price_id,a.reconciliation_revision
$$;

-- Entitlements are created only after canonical provider verification in the server,
-- never by redirect, customer claims or unauthenticated database calls.
create function public.apply_premium_live_reconciliation(
  p_subscription text,p_customer text,p_revision integer,
  p_stripe_status text,p_price text,p_invoice text,
  p_starts timestamptz,p_ends timestamptz,p_verified_paid boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare attempt snoozer.premium_live_checkouts;
declare offer snoozer.premium_live_prices;
declare gr text := 'live:'||p_subscription;
declare is_eligible boolean := false;
begin
  select * into attempt from snoozer.premium_live_checkouts a
  where a.subscription_id=p_subscription and a.status='bound'
    and a.reconciliation_revision=p_revision
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=a.owner_id and c.customer_id=p_customer)
  for update;
  if not found then return false; end if;
  if p_stripe_status not in ('active','trialing','canceled','incomplete','incomplete_expired','past_due','paused','unpaid')
    then raise exception 'Invalid Stripe subscription status'; end if;
  select * into offer from snoozer.premium_live_prices where price_id=p_price;
  is_eligible := p_stripe_status='active' and p_verified_paid is true
    and found and p_invoice ~ '^in_[A-Za-z0-9]{1,128}$'
    and p_starts<=now() and p_ends>now()
    and not exists(select 1 from snoozer.premium_live_invoice_holds h
       where h.invoice_id=p_invoice and h.subscription_id=p_subscription and h.customer_id=p_customer);
  if is_eligible then
    insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
    values(attempt.owner_id,offer.plan,offer.plan_version,'stripe',gr,p_starts,p_ends)
    on conflict(source,source_ref) do update set
      plan=excluded.plan,plan_version=excluded.plan_version,starts_at=excluded.starts_at,
      expires_at=excluded.expires_at,revoked_at=null
      where snoozer.entitlement_grants.owner_id=excluded.owner_id;
  else
    update snoozer.entitlement_grants set revoked_at=now()
    where source='stripe' and source_ref=gr and owner_id=attempt.owner_id and revoked_at is null;
  end if;
  update snoozer.premium_live_checkouts set
    last_invoice=case when p_invoice ~ '^in_[A-Za-z0-9]{1,128}$' then p_invoice else last_invoice end,
    last_status=p_stripe_status,last_checked_at=now(),
    status=case when p_stripe_status in ('canceled','incomplete_expired') then 'ended' else status end,
    reconciliation_revision=reconciliation_revision+1
  where id=attempt.id;
  return true;
end $$;

-- Conservative sticky risk holds. No automatic dispute 'won' release: operator review is needed.
create function public.hold_premium_live_invoice(
  p_event text,p_invoice text,p_subscription text,p_customer text,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if p_reason not in ('refund','dispute','fraud') then return false; end if;
  select a.owner_id into owner from snoozer.premium_live_checkouts a
  join snoozer.premium_live_customers c on c.owner_id=a.owner_id
  where a.subscription_id=p_subscription and c.customer_id=p_customer;
  if owner is null or (p_event is not null and not exists(select 1 from snoozer.premium_live_receipts r
      where r.event_id=p_event)) then return false; end if;
  insert into snoozer.premium_live_invoice_holds(invoice_id,subscription_id,customer_id,reason,event_id)
    values(p_invoice,p_subscription,p_customer,p_reason,p_event)
  on conflict(invoice_id) do nothing;
  update snoozer.entitlement_grants set revoked_at=now()
    where source='stripe' and source_ref='live:'||p_subscription and owner_id=owner
      and revoked_at is null;
  return true;
end $$;

create function public.get_my_premium_live_billing()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('hasCustomer',c.customer_id is not null,
    'subscriptionStatus',a.last_status,'hasSubscription',a.subscription_id is not null,
    'lastCheckedAt',a.last_checked_at)
  from (select snoozer.verified_user() as id) v
  left join snoozer.premium_live_customers c on c.owner_id=v.id
  left join lateral(select last_status,subscription_id,last_checked_at
      from snoozer.premium_live_checkouts where owner_id=v.id order by created_at desc limit 1) a on true
$$;

revoke execute on function public.list_premium_live_offers(),
  public.prepare_premium_live_checkout(uuid,text),
  public.bind_premium_live_customer(uuid,uuid,text),
  public.bind_premium_live_session(uuid,uuid,text,text),
  public.bind_premium_live_subscription(uuid,text,text,text),
  public.record_premium_live_receipt(text,text,text,timestamptz),
  public.finish_premium_live_receipt(text),
  public.start_premium_live_reconciliation(text),
  public.apply_premium_live_reconciliation(text,text,integer,text,text,text,timestamptz,timestamptz,boolean),
  public.hold_premium_live_invoice(text,text,text,text,text),
  public.get_my_premium_live_billing()
  from public,anon,authenticated,service_role;
grant execute on function public.list_premium_live_offers(),
  public.prepare_premium_live_checkout(uuid,text),
  public.bind_premium_live_customer(uuid,uuid,text),
  public.bind_premium_live_session(uuid,uuid,text,text),
  public.bind_premium_live_subscription(uuid,text,text,text),
  public.record_premium_live_receipt(text,text,text,timestamptz),
  public.finish_premium_live_receipt(text),
  public.start_premium_live_reconciliation(text),
  public.apply_premium_live_reconciliation(text,text,integer,text,text,text,timestamptz,timestamptz,boolean),
  public.hold_premium_live_invoice(text,text,text,text,text)
  to service_role;
grant execute on function public.get_my_premium_live_billing() to authenticated;


-- Allows reliable retry after Stripe itself confirms expiry; no guessed clock-only release.
create function public.expire_premium_live_checkout(
  p_owner uuid,p_customer text,p_session text
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  update snoozer.premium_live_checkouts a set status='expired'
    where a.owner_id=p_owner and a.session_id=p_session and a.status='pending'
    and a.subscription_id is null
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end $$;
revoke execute on function public.expire_premium_live_checkout(uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.expire_premium_live_checkout(uuid,text,text) to service_role;

create function public.get_premium_live_customer(p_owner uuid)
returns text language sql stable security definer set search_path='' as $$
  select customer_id from snoozer.premium_live_customers where owner_id=p_owner
$$;
revoke execute on function public.get_premium_live_customer(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.get_premium_live_customer(uuid) to service_role;

-- Bounded provider reconciliation can safely revisit active subscriptions after missed events.
create function public.list_premium_live_reconcile_candidates(p_limit integer default 5)
returns table(subscription_id text)
language sql stable security definer set search_path='' as $$
  select a.subscription_id from snoozer.premium_live_checkouts a
  where a.status='bound' and a.subscription_id is not null
    and (a.last_checked_at is null or a.last_checked_at < now() - interval '3 hours')
  order by a.last_checked_at nulls first,a.created_at
  limit least(greatest(p_limit,1),10)
$$;
revoke execute on function public.list_premium_live_reconcile_candidates(integer)
  from public,anon,authenticated,service_role;
grant execute on function public.list_premium_live_reconcile_candidates(integer) to service_role;
