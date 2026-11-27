begin;

-- Image Host is a separate lifetime add-on. It must never mutate Snoozer
-- Premium plan prices, subscription records or entitlement grants.
create table snoozer.image_host_policy (
  singleton boolean primary key default true check(singleton),
  checkout_enabled boolean not null default false,
  tax_reviewed boolean not null default false,
  legal_reviewed boolean not null default false,
  automatic_tax_enabled boolean not null default false,
  reviewed_at timestamptz
);
insert into snoozer.image_host_policy(singleton) values(true);

-- The recording's offer is a single EUR 4.99 lifetime payment, never recurring.
create table snoozer.image_host_prices (
  price_id text primary key check(price_id ~ '^price_[A-Za-z0-9]{1,128}$'),
  product_id text not null check(product_id ~ '^prod_[A-Za-z0-9]{1,128}$'),
  currency text not null check(currency='eur'),
  unit_amount integer not null check(unit_amount=499),
  retired_at timestamptz
);
create unique index image_host_current_offer
  on snoozer.image_host_prices(currency)
  where retired_at is null;

create table snoozer.image_host_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null references snoozer.image_host_prices(price_id),
  session_id text unique check(session_id is null or session_id ~ '^cs_live_[A-Za-z0-9]{1,128}$'),
  payment_intent_id text unique check(payment_intent_id is null or payment_intent_id ~ '^pi_[A-Za-z0-9]{1,128}$'),
  status text not null default 'reserved'
    check(status in ('reserved','pending','active','expired','refunded','disputed','fraud')),
  created_at timestamptz not null default date_trunc('second',now()),
  expires_at timestamptz not null default date_trunc('second',now())+interval '60 minutes',
  verified_at timestamptz,
  last_checked_at timestamptz,
  check(expires_at>created_at),
  check((status in ('active','refunded','disputed','fraud'))=(verified_at is not null))
);
create unique index image_host_one_open_or_active_purchase_per_owner
  on snoozer.image_host_purchases(owner_id)
  where status in ('reserved','pending','active');
create index image_host_purchase_owner_history
  on snoozer.image_host_purchases(owner_id,created_at desc);

create table snoozer.image_host_payment_holds (
  payment_intent_id text primary key check(payment_intent_id ~ '^pi_[A-Za-z0-9]{1,128}$'),
  reason text not null check(reason in ('refund','dispute','fraud')),
  event_id text not null check(event_id ~ '^evt_[A-Za-z0-9]{1,128}$'),
  created_at timestamptz not null default now()
);

alter table snoozer.image_host_policy enable row level security;
alter table snoozer.image_host_prices enable row level security;
alter table snoozer.image_host_purchases enable row level security;
alter table snoozer.image_host_payment_holds enable row level security;
revoke all on snoozer.image_host_policy,snoozer.image_host_prices,
  snoozer.image_host_purchases,snoozer.image_host_payment_holds
  from public,anon,authenticated,service_role;

create function public.list_image_host_addon_offers()
returns table(
  price_id text,product_id text,currency text,unit_amount integer,
  automatic_tax_enabled boolean
)
language sql stable security definer set search_path=''
as $function$
  select p.price_id,p.product_id,p.currency,p.unit_amount,k.automatic_tax_enabled
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
  attempt snoozer.image_host_purchases;
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

  if exists(select 1 from snoozer.image_host_purchases
    where owner_id=p_owner and status='active') then
    return null;
  end if;

  select * into offer from snoozer.image_host_prices
    where price_id=p_price and retired_at is null;
  if not found then return null; end if;

  select * into attempt from snoozer.image_host_purchases
    where owner_id=p_owner and status in ('reserved','pending')
    order by created_at desc limit 1
    for update;
  if found then
    if attempt.price_id<>p_price or attempt.expires_at<=now() then
      update snoozer.image_host_purchases set status='expired'
        where id=attempt.id and status in ('reserved','pending');
      attempt:=null;
    end if;
  end if;

  if attempt.id is null then
    insert into snoozer.image_host_purchases(owner_id,price_id)
      values(p_owner,p_price) returning * into attempt;
  end if;

  return jsonb_build_object(
    'id',attempt.id,'priceId',attempt.price_id,'productId',offer.product_id,
    'currency',offer.currency,'amount',offer.unit_amount,
    'sessionId',attempt.session_id,
    'expires',extract(epoch from attempt.expires_at)::bigint
  );
end
$function$;

create function public.bind_image_host_session(p_owner uuid,p_attempt uuid,p_session text)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if p_session !~ '^cs_live_[A-Za-z0-9]{1,128}$' then return false; end if;
  update snoozer.image_host_purchases a
    set session_id=coalesce(a.session_id,p_session),status='pending'
    where a.id=p_attempt and a.owner_id=p_owner
      and a.status in ('reserved','pending')
      and (a.session_id is null or a.session_id=p_session)
      and a.expires_at>now();
  return found;
end
$function$;

create function public.complete_image_host_purchase(
  p_owner uuid,p_attempt uuid,p_session text,p_payment_intent text,
  p_price text,p_currency text,p_amount integer,p_paid boolean
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare attempt snoozer.image_host_purchases;
declare offer snoozer.image_host_prices;
begin
  if p_payment_intent !~ '^pi_[A-Za-z0-9]{1,128}$'
    or p_currency<>'eur' or p_amount<>499 or p_paid is not true then
    return false;
  end if;
  select * into attempt from snoozer.image_host_purchases
    where id=p_attempt and owner_id=p_owner and session_id=p_session
      and price_id=p_price and status in ('pending','active')
    for update;
  if not found then return false; end if;
  select * into offer from snoozer.image_host_prices
    where price_id=p_price and currency=p_currency and unit_amount=p_amount;
  if not found then return false; end if;
  if exists(select 1 from snoozer.image_host_payment_holds
    where payment_intent_id=p_payment_intent) then return false; end if;
  update snoozer.image_host_purchases
    set payment_intent_id=coalesce(payment_intent_id,p_payment_intent),
        status='active',verified_at=coalesce(verified_at,now()),last_checked_at=now()
    where id=attempt.id
      and (payment_intent_id is null or payment_intent_id=p_payment_intent);
  return found;
end
$function$;

create function public.expire_image_host_checkout(p_owner uuid,p_attempt uuid,p_session text)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  update snoozer.image_host_purchases a set status='expired'
    where a.id=p_attempt and a.owner_id=p_owner and a.session_id=p_session
      and a.status='pending' and a.payment_intent_id is null;
  return found;
end
$function$;

create function public.hold_image_host_payment(
  p_event text,p_payment_intent text,p_reason text
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare purchase snoozer.image_host_purchases;
begin
  if p_event !~ '^evt_[A-Za-z0-9]{1,128}$'
    or p_payment_intent !~ '^pi_[A-Za-z0-9]{1,128}$'
    or p_reason not in ('refund','dispute','fraud') then return false; end if;
  select * into purchase from snoozer.image_host_purchases
    where payment_intent_id=p_payment_intent and status in ('active','refunded','disputed','fraud')
    for update;
  if not found then return false; end if;
  insert into snoozer.image_host_payment_holds(payment_intent_id,reason,event_id)
    values(p_payment_intent,p_reason,p_event)
    on conflict(payment_intent_id) do nothing;
  update snoozer.image_host_purchases
    set status=case p_reason when 'refund' then 'refunded' when 'dispute' then 'disputed' else 'fraud' end,
        last_checked_at=now()
    where id=purchase.id;
  return true;
end
$function$;

create function public.get_my_image_host_status()
returns jsonb language sql stable security definer set search_path=''
as $function$
  with actor as materialized (select snoozer.verified_user() as id),
  latest as (
    select a.status,a.verified_at,a.created_at,a.payment_intent_id
    from snoozer.image_host_purchases a
    join actor on actor.id=a.owner_id
    order by a.created_at desc
    limit 1
  )
  select jsonb_build_object(
    'active',coalesce(latest.status='active',false),
    'status',latest.status,
    'verifiedAt',latest.verified_at,
    'paymentIntent',latest.payment_intent_id
  )
  from actor left join latest on true
$function$;

create function public.image_host_live_preflight()
returns jsonb language sql stable security definer set search_path=''
as $function$
  select jsonb_build_object(
    'checkoutEnabled',k.checkout_enabled,
    'taxReviewed',k.tax_reviewed,
    'legalReviewed',k.legal_reviewed,
    'automaticTaxEnabled',k.automatic_tax_enabled,
    'approvedOffers',(select count(*) from snoozer.image_host_prices where retired_at is null),
    'activePurchases',(select count(*) from snoozer.image_host_purchases where status='active'),
    'unprocessedPremiumReceipts',(select count(*) from snoozer.premium_live_receipts where processed_at is null)
  ) from snoozer.image_host_policy k where k.singleton
$function$;

revoke execute on function public.list_image_host_addon_offers(),
  public.prepare_image_host_checkout(uuid,text),
  public.bind_image_host_session(uuid,uuid,text),
  public.complete_image_host_purchase(uuid,uuid,text,text,text,text,integer,boolean),
  public.expire_image_host_checkout(uuid,uuid,text),
  public.hold_image_host_payment(text,text,text),
  public.get_my_image_host_status(),
  public.image_host_live_preflight()
  from public,anon,authenticated,service_role;

grant execute on function public.list_image_host_addon_offers(),
  public.prepare_image_host_checkout(uuid,text),
  public.bind_image_host_session(uuid,uuid,text),
  public.complete_image_host_purchase(uuid,uuid,text,text,text,text,integer,boolean),
  public.expire_image_host_checkout(uuid,uuid,text),
  public.hold_image_host_payment(text,text,text),
  public.image_host_live_preflight()
  to service_role;
grant execute on function public.get_my_image_host_status() to authenticated;

commit;
