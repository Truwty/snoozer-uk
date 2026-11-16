create table snoozer.stripe_sandbox_gift_offers (
  id uuid primary key default gen_random_uuid(),
  price_id text not null unique check (price_id ~ '^price_[A-Za-z0-9]{1,128}$'),
  plan text not null check (plan <> 'free'),
  plan_version integer not null,
  duration_days integer not null check (duration_days between 1 and 366),
  amount_pence integer not null check (amount_pence > 0),
  retired_at timestamptz,
  foreign key (plan, plan_version) references snoozer.plan_versions(plan, version)
);

create table snoozer.stripe_sandbox_gift_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  offer_id uuid not null references snoozer.stripe_sandbox_gift_offers(id),
  request_id uuid not null,
  created_at timestamptz not null default date_trunc('second',now()),
  session_id text unique check (session_id ~ '^cs_test_[A-Za-z0-9]{1,128}$'),
  payment_id text unique check (payment_id ~ '^pi_[A-Za-z0-9]{1,128}$'),
  gift_id uuid unique references snoozer.gift_codes(id),
  unique (buyer_id, request_id),
  check ((payment_id is null) = (gift_id is null)),
  check (gift_id is null or session_id is not null)
);

create table snoozer.stripe_sandbox_gift_payment_holds (
  payment_id text primary key check (payment_id ~ '^pi_[A-Za-z0-9]{1,128}$'),
  event_id text not null references snoozer.stripe_webhook_receipts(event_id),
  created_at timestamptz not null default now()
);

alter table snoozer.stripe_sandbox_gift_offers enable row level security;
alter table snoozer.stripe_sandbox_gift_orders enable row level security;
alter table snoozer.stripe_sandbox_gift_payment_holds enable row level security;
revoke all on snoozer.stripe_sandbox_gift_offers,snoozer.stripe_sandbox_gift_orders,snoozer.stripe_sandbox_gift_payment_holds
  from public,anon,authenticated,service_role;

create function public.prepare_stripe_sandbox_gift(p_buyer uuid, p_offer uuid, p_request uuid)
returns table(order_id uuid, stripe_price text, amount_pence integer, session_id text, expires_epoch bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = p_buyer and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift-buyer:' || p_buyer::text,0));
  if not exists (select 1 from snoozer.stripe_sandbox_gift_orders where buyer_id=p_buyer and request_id=p_request)
    and (select count(*) from snoozer.stripe_sandbox_gift_orders where buyer_id=p_buyer
      and created_at >= now()-interval '1 day') >= 5 then return; end if;
  insert into snoozer.stripe_sandbox_gift_orders(buyer_id,offer_id,request_id)
  select p_buyer,o.id,p_request from snoozer.stripe_sandbox_gift_offers o
  where o.id = p_offer and o.retired_at is null
  on conflict (buyer_id,request_id) do nothing;
  return query
    select g.id,o.price_id,o.amount_pence,g.session_id,extract(epoch from g.created_at + interval '2 hours')::bigint
    from snoozer.stripe_sandbox_gift_orders g join snoozer.stripe_sandbox_gift_offers o on o.id = g.offer_id
    where g.buyer_id = p_buyer and g.request_id = p_request and g.offer_id = p_offer
      and g.gift_id is null and (g.session_id is not null or g.created_at > now()-interval '30 minutes');
end
$$;

create function public.bind_stripe_sandbox_gift_session(p_buyer uuid,p_order uuid,p_session text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_session is null then return false; end if;
  update snoozer.stripe_sandbox_gift_orders set session_id = p_session
  where id = p_order and buyer_id = p_buyer and (session_id is null or session_id = p_session);
  return found;
end
$$;

create function public.fulfill_stripe_sandbox_gift(
  p_event text,p_buyer uuid,p_order uuid,p_session text,p_payment text,p_price text,p_amount integer,p_code_hash bytea
) returns text language plpgsql security definer set search_path = '' as $$
declare
  gift_order snoozer.stripe_sandbox_gift_orders;
  offer snoozer.stripe_sandbox_gift_offers;
  issued uuid;
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return 'unmatched'; end if;
  if not exists (
    select 1 from snoozer.stripe_webhook_receipts where event_id=p_event and object_id=p_session
    and event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
  ) then return 'unmatched'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  select * into gift_order from snoozer.stripe_sandbox_gift_orders
  where id=p_order and buyer_id=p_buyer and session_id=p_session for update;
  if not found then return 'unmatched'; end if;
  select * into strict offer from snoozer.stripe_sandbox_gift_offers where id=gift_order.offer_id;
  if offer.price_id is distinct from p_price or offer.amount_pence is distinct from p_amount then return 'unmatched'; end if;
  if exists (select 1 from snoozer.stripe_sandbox_gift_payment_holds where payment_id=p_payment) then return 'held'; end if;
  if gift_order.gift_id is not null then
    if gift_order.payment_id=p_payment then return 'fulfilled'; end if;
    return 'unmatched';
  end if;

  insert into snoozer.gift_codes(code_hash,plan,plan_version,duration_days,expires_at)
  values (p_code_hash,offer.plan,offer.plan_version,offer.duration_days,now()+interval '365 days')
  returning id into issued;
  update snoozer.stripe_sandbox_gift_orders set payment_id=p_payment,gift_id=issued where id=p_order;
  return 'fulfilled';
end
$$;

create function public.hold_stripe_sandbox_gift_payment(p_event text,p_payment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  issued uuid;
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  insert into snoozer.stripe_sandbox_gift_payment_holds(payment_id,event_id)
  select p_payment,event_id from snoozer.stripe_webhook_receipts
  where event_id=p_event and event_type in ('charge.refunded','charge.dispute.created','radar.early_fraud_warning.created')
  on conflict (payment_id) do nothing;
  if not found then return; end if;
  select gift_id into issued from snoozer.stripe_sandbox_gift_orders where payment_id=p_payment;
  if issued is not null then perform public.revoke_gift_code(issued); end if;
end
$$;

revoke execute on function public.prepare_stripe_sandbox_gift(uuid,uuid,uuid),
  public.bind_stripe_sandbox_gift_session(uuid,uuid,text),
  public.fulfill_stripe_sandbox_gift(text,uuid,uuid,text,text,text,integer,bytea),
  public.hold_stripe_sandbox_gift_payment(text,text) from public,anon,authenticated,service_role;
grant execute on function public.prepare_stripe_sandbox_gift(uuid,uuid,uuid),
  public.bind_stripe_sandbox_gift_session(uuid,uuid,text),
  public.fulfill_stripe_sandbox_gift(text,uuid,uuid,text,text,text,integer,bytea),
  public.hold_stripe_sandbox_gift_payment(text,text) to service_role;

create function public.find_stripe_sandbox_gift_order(p_session text)
returns table(order_id uuid,buyer_id uuid,stripe_price text,amount_pence integer)
language sql stable security definer set search_path = '' as $$
  select g.id,g.buyer_id,o.price_id,o.amount_pence
  from snoozer.stripe_sandbox_gift_orders g join snoozer.stripe_sandbox_gift_offers o on o.id=g.offer_id
  where g.session_id=p_session and g.buyer_id is not null
$$;
revoke execute on function public.find_stripe_sandbox_gift_order(text) from public,anon,authenticated,service_role;
grant execute on function public.find_stripe_sandbox_gift_order(text) to service_role;

create function public.list_stripe_sandbox_gift_offers()
returns table(id uuid,plan text,duration_days integer,amount_pence integer)
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select o.id,o.plan,o.duration_days,o.amount_pence from actor
  cross join snoozer.stripe_sandbox_gift_offers o
  where actor.id is not null and o.retired_at is null
  order by o.amount_pence,o.id limit 30
$$;

create function public.list_my_stripe_sandbox_gifts()
returns table(order_id uuid,plan text,status text,code_hash text)
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select g.id,o.plan,case
    when c.revoked_at is not null then 'revoked'
    when c.redeemed_at is not null then 'redeemed'
    when c.expires_at <= now() then 'expired'
    else 'ready'
  end,
  case when c.revoked_at is null and c.redeemed_at is null and c.expires_at > now()
    then encode(c.code_hash,'hex') end
  from actor join snoozer.stripe_sandbox_gift_orders g on g.buyer_id=actor.id
  join snoozer.stripe_sandbox_gift_offers o on o.id=g.offer_id
  join snoozer.gift_codes c on c.id=g.gift_id
  order by g.created_at desc,g.id limit 30
$$;
revoke execute on function public.list_stripe_sandbox_gift_offers(),public.list_my_stripe_sandbox_gifts()
  from public,anon,authenticated,service_role;
grant execute on function public.list_stripe_sandbox_gift_offers(),public.list_my_stripe_sandbox_gifts() to authenticated;
