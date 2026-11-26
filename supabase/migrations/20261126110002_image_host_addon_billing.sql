begin;

-- Image Host is an optional, separate subscription. It never changes the
-- account's Plus/Pro/Studio entitlement grant.
create table snoozer.image_host_policy (
  singleton boolean primary key default true check(singleton),
  checkout_enabled boolean not null default false,
  tax_reviewed boolean not null default false,
  legal_reviewed boolean not null default false,
  reviewed_at timestamptz
);
insert into snoozer.image_host_policy(singleton) values(true);

create table snoozer.image_host_prices (
  price_id text primary key check(price_id ~ '^price_[A-Za-z0-9]{1,128}$'),
  product_id text not null check(product_id ~ '^prod_[A-Za-z0-9]{1,128}$'),
  currency text not null check(currency='eur'),
  unit_amount integer not null check(unit_amount=499),
  billing_interval text not null check(billing_interval='month'),
  retired_at timestamptz
);
create unique index image_host_current_offer
  on snoozer.image_host_prices(currency,billing_interval)
  where retired_at is null;

create table snoozer.image_host_checkouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null references snoozer.image_host_prices(price_id),
  session_id text unique check(session_id is null or session_id ~ '^cs_live_[A-Za-z0-9]{1,128}$'),
  subscription_id text unique check(subscription_id is null or subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  status text not null default 'reserved'
    check(status in ('reserved','pending','bound','expired','ended')),
  created_at timestamptz not null default date_trunc('second',now()),
  expires_at timestamptz not null default date_trunc('second',now())+interval '60 minutes',
  reconciliation_revision integer not null default 0,
  last_invoice text check(last_invoice is null or last_invoice ~ '^in_[A-Za-z0-9]{1,128}$'),
  last_status text check(last_status is null or last_status in
    ('active','trialing','canceled','incomplete','incomplete_expired','past_due','paused','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_checked_at timestamptz,
  check(expires_at>created_at),
  check(current_period_end is null or current_period_start is not null and current_period_end>current_period_start)
);
create unique index image_host_one_nonterminal_checkout_per_owner
  on snoozer.image_host_checkouts(owner_id)
  where status in ('reserved','pending','bound');
create index image_host_checkouts_subscription
  on snoozer.image_host_checkouts(subscription_id) where subscription_id is not null;

create table snoozer.image_host_invoice_holds (
  invoice_id text primary key check(invoice_id ~ '^in_[A-Za-z0-9]{1,128}$'),
  subscription_id text not null check(subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  customer_id text not null check(customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
  reason text not null check(reason in ('refund','dispute','fraud')),
  event_id text references snoozer.premium_live_receipts(event_id),
  created_at timestamptz not null default now()
);

alter table snoozer.image_host_policy enable row level security;
alter table snoozer.image_host_prices enable row level security;
alter table snoozer.image_host_checkouts enable row level security;
alter table snoozer.image_host_invoice_holds enable row level security;
revoke all on snoozer.image_host_policy,snoozer.image_host_prices,
  snoozer.image_host_checkouts,snoozer.image_host_invoice_holds
  from public,anon,authenticated,service_role;

create function public.list_image_host_addon_offers()
returns table(price_id text,product_id text,currency text,unit_amount integer,billing_interval text)
language sql stable security definer set search_path=''
as $function$
  select p.price_id,p.product_id,p.currency,p.unit_amount,p.billing_interval
  from snoozer.image_host_prices p
  join snoozer.image_host_policy k on k.singleton=true
  where k.checkout_enabled and k.tax_reviewed and k.legal_reviewed
    and p.retired_at is null
  order by p.price_id
$function$;

create function public.prepare_image_host_checkout(p_owner uuid,p_price text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  offer snoozer.image_host_prices;
  attempt snoozer.image_host_checkouts;
  cid text;
begin
  perform 1 from auth.users
    where id=p_owner and email_confirmed_at is not null
    for update;
  if not found then
    raise exception 'Verified account required' using errcode='42501';
  end if;
  if not exists(select 1 from snoozer.image_host_policy
    where singleton and checkout_enabled and tax_reviewed and legal_reviewed) then
    return null;
  end if;

  select * into offer from snoozer.image_host_prices
    where price_id=p_price and retired_at is null;
  if not found then return null; end if;

  if exists(select 1 from snoozer.image_host_checkouts
    where owner_id=p_owner and status='bound' and last_status='active'
      and current_period_end>now()) then
    return null;
  end if;

  select customer_id into cid from snoozer.premium_live_customers where owner_id=p_owner;
  select * into attempt from snoozer.image_host_checkouts
    where owner_id=p_owner and status in ('reserved','pending','bound')
    for update;
  if found then
    if attempt.status='bound' or attempt.price_id<>p_price or attempt.expires_at<=now() then
      return null;
    end if;
  else
    insert into snoozer.image_host_checkouts(owner_id,price_id)
      values(p_owner,p_price) returning * into attempt;
  end if;

  return jsonb_build_object(
    'id',attempt.id,'priceId',attempt.price_id,'productId',offer.product_id,
    'currency',offer.currency,'amount',offer.unit_amount,'interval',offer.billing_interval,
    'customerId',cid,'sessionId',attempt.session_id,
    'expires',extract(epoch from attempt.expires_at)::bigint
  );
end
$function$;

-- This reuses the single Snoozer Stripe customer shared with Premium, preventing
-- duplicate Customer records when an owner already has another subscription.
create function public.bind_image_host_customer(p_owner uuid,p_attempt uuid,p_customer text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare existing_customer text;
begin
  if p_customer !~ '^cus_[A-Za-z0-9]{1,128}$'
    or not exists(select 1 from snoozer.image_host_checkouts
      where id=p_attempt and owner_id=p_owner and status in ('reserved','pending')) then
    return false;
  end if;
  insert into snoozer.premium_live_customers(owner_id,customer_id)
    values(p_owner,p_customer) on conflict(owner_id) do nothing;
  select customer_id into existing_customer from snoozer.premium_live_customers
    where owner_id=p_owner;
  return existing_customer=p_customer;
end
$function$;

create function public.bind_image_host_session(p_owner uuid,p_attempt uuid,p_customer text,p_session text)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if p_session !~ '^cs_live_[A-Za-z0-9]{1,128}$' then return false; end if;
  update snoozer.image_host_checkouts a
    set session_id=coalesce(a.session_id,p_session),status='pending'
    where a.id=p_attempt and a.owner_id=p_owner
      and a.status in ('reserved','pending')
      and (a.session_id is null or a.session_id=p_session)
      and exists(select 1 from snoozer.premium_live_customers c
        where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end
$function$;

create function public.bind_image_host_subscription(p_owner uuid,p_customer text,p_session text,p_subscription text)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if p_subscription !~ '^sub_[A-Za-z0-9]{1,128}$' then return false; end if;
  update snoozer.image_host_checkouts a set
    subscription_id=coalesce(a.subscription_id,p_subscription),status='bound'
  where a.owner_id=p_owner and a.session_id=p_session
    and a.status in ('pending','bound')
    and (a.subscription_id is null or a.subscription_id=p_subscription)
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end
$function$;

create function public.start_image_host_reconciliation(p_subscription text)
returns table(owner_id uuid,customer_id text,price_id text,revision integer)
language sql security definer set search_path=''
as $function$
  update snoozer.image_host_checkouts a
    set reconciliation_revision=reconciliation_revision+1
    from snoozer.premium_live_customers c
    where a.subscription_id=p_subscription and a.owner_id=c.owner_id and a.status='bound'
    returning a.owner_id,c.customer_id,a.price_id,a.reconciliation_revision
$function$;

create function public.apply_image_host_reconciliation(
  p_subscription text,p_customer text,p_revision integer,p_stripe_status text,
  p_price text,p_invoice text,p_starts timestamptz,p_ends timestamptz,p_verified_paid boolean
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare attempt snoozer.image_host_checkouts;
declare offer snoozer.image_host_prices;
declare eligible boolean:=false;
begin
  select * into attempt from snoozer.image_host_checkouts a
    where a.subscription_id=p_subscription and a.status='bound'
      and a.reconciliation_revision=p_revision
      and exists(select 1 from snoozer.premium_live_customers c
        where c.owner_id=a.owner_id and c.customer_id=p_customer)
    for update;
  if not found then return false; end if;
  if p_stripe_status not in ('active','trialing','canceled','incomplete','incomplete_expired','past_due','paused','unpaid') then
    raise exception 'Invalid Stripe subscription status' using errcode='22023';
  end if;
  select * into offer from snoozer.image_host_prices
    where price_id=p_price and retired_at is null;
  eligible:=found and p_stripe_status='active' and p_verified_paid is true
    and p_invoice ~ '^in_[A-Za-z0-9]{1,128}$'
    and p_starts<=now() and p_ends>now()
    and not exists(select 1 from snoozer.image_host_invoice_holds h
      where h.invoice_id=p_invoice and h.subscription_id=p_subscription and h.customer_id=p_customer);

  update snoozer.image_host_checkouts set
    last_invoice=case when p_invoice ~ '^in_[A-Za-z0-9]{1,128}$' then p_invoice else last_invoice end,
    last_status=p_stripe_status,
    current_period_start=p_starts,
    current_period_end=p_ends,
    last_checked_at=now(),
    status=case when p_stripe_status in ('canceled','incomplete_expired') then 'ended' else status end,
    reconciliation_revision=reconciliation_revision+1
    where id=attempt.id;

  return eligible;
end
$function$;

create function public.hold_image_host_invoice(
  p_event text,p_invoice text,p_subscription text,p_customer text,p_reason text
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare owner uuid;
begin
  if p_reason not in ('refund','dispute','fraud') then return false; end if;
  select a.owner_id into owner from snoozer.image_host_checkouts a
    join snoozer.premium_live_customers c on c.owner_id=a.owner_id
    where a.subscription_id=p_subscription and a.status='bound' and c.customer_id=p_customer;
  if owner is null or (p_event is not null and not exists(
    select 1 from snoozer.premium_live_receipts r where r.event_id=p_event
  )) then return false; end if;
  insert into snoozer.image_host_invoice_holds(invoice_id,subscription_id,customer_id,reason,event_id)
    values(p_invoice,p_subscription,p_customer,p_reason,p_event)
    on conflict(invoice_id) do nothing;
  return true;
end
$function$;

create function public.get_my_image_host_status()
returns jsonb language sql stable security definer set search_path=''
as $function$
  with actor as materialized (select snoozer.verified_user() as id),
  latest as (
    select a.last_status,a.current_period_end,a.subscription_id,a.last_checked_at,
      exists(select 1 from snoozer.image_host_invoice_holds h
        where h.invoice_id=a.last_invoice and h.subscription_id=a.subscription_id) as risk_hold
    from snoozer.image_host_checkouts a
    join actor on actor.id=a.owner_id
    where a.status in ('bound','ended')
    order by a.created_at desc
    limit 1
  )
  select jsonb_build_object(
    'active',coalesce(latest.last_status='active' and latest.current_period_end>now() and not latest.risk_hold,false),
    'status',latest.last_status,
    'periodEnd',latest.current_period_end,
    'subscriptionId',latest.subscription_id,
    'lastCheckedAt',latest.last_checked_at
  )
  from actor left join latest on true
$function$;

create function public.expire_image_host_checkout(p_owner uuid,p_customer text,p_session text)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  update snoozer.image_host_checkouts a set status='expired'
    where a.owner_id=p_owner and a.session_id=p_session and a.status='pending'
      and a.subscription_id is null
      and exists(select 1 from snoozer.premium_live_customers c
        where c.owner_id=p_owner and c.customer_id=p_customer);
  return found;
end
$function$;

create function public.list_image_host_reconcile_candidates(p_limit integer default 5)
returns table(subscription_id text)
language sql stable security definer set search_path=''
as $function$
  select a.subscription_id from snoozer.image_host_checkouts a
    where a.status='bound' and a.subscription_id is not null
      and (a.last_checked_at is null or a.last_checked_at<now()-interval '3 hours')
    order by a.last_checked_at nulls first,a.created_at
    limit least(greatest(p_limit,1),10)
$function$;

create function public.image_host_live_preflight()
returns jsonb language sql stable security definer set search_path=''
as $function$
  select jsonb_build_object(
    'checkoutEnabled',k.checkout_enabled,'taxReviewed',k.tax_reviewed,'legalReviewed',k.legal_reviewed,
    'approvedOffers',(select count(*) from snoozer.image_host_prices where retired_at is null),
    'customers',(select count(*) from snoozer.premium_live_customers c
      where exists(select 1 from snoozer.image_host_checkouts a where a.owner_id=c.owner_id)),
    'activeSubscriptions',(select count(*) from snoozer.image_host_checkouts
      where status='bound' and last_status='active' and current_period_end>now()),
    'unprocessedPremiumReceipts',(select count(*) from snoozer.premium_live_receipts where processed_at is null)
  ) from snoozer.image_host_policy k where k.singleton
$function$;

revoke execute on function public.list_image_host_addon_offers(),
  public.prepare_image_host_checkout(uuid,text),
  public.bind_image_host_customer(uuid,uuid,text),
  public.bind_image_host_session(uuid,uuid,text,text),
  public.bind_image_host_subscription(uuid,text,text,text),
  public.start_image_host_reconciliation(text),
  public.apply_image_host_reconciliation(text,text,integer,text,text,timestamptz,timestamptz,boolean),
  public.hold_image_host_invoice(text,text,text,text,text),
  public.get_my_image_host_status(),
  public.expire_image_host_checkout(uuid,text,text),
  public.list_image_host_reconcile_candidates(integer),
  public.image_host_live_preflight()
  from public,anon,authenticated,service_role;

grant execute on function public.list_image_host_addon_offers(),
  public.prepare_image_host_checkout(uuid,text),
  public.bind_image_host_customer(uuid,uuid,text),
  public.bind_image_host_session(uuid,uuid,text,text),
  public.bind_image_host_subscription(uuid,text,text,text),
  public.start_image_host_reconciliation(text),
  public.apply_image_host_reconciliation(text,text,integer,text,text,text,timestamptz,timestamptz,boolean),
  public.hold_image_host_invoice(text,text,text,text,text),
  public.expire_image_host_checkout(uuid,text,text),
  public.list_image_host_reconcile_candidates(integer),
  public.image_host_live_preflight()
  to service_role;
grant execute on function public.get_my_image_host_status() to authenticated;

commit;
