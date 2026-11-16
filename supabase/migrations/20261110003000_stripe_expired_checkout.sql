create table snoozer.stripe_sandbox_expired_checkouts (
  session_id text primary key,
  attempt_id uuid not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null references snoozer.stripe_sandbox_prices(price_id),
  expired_at timestamptz not null default now()
);
alter table snoozer.stripe_sandbox_expired_checkouts enable row level security;
revoke all on snoozer.stripe_sandbox_expired_checkouts from public, anon, authenticated, service_role;

alter table snoozer.stripe_sandbox_checkout_attempts add column expired_at timestamptz;

create function public.mark_stripe_sandbox_checkout_expired(p_event text, p_session text, p_customer text, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
begin
  if not exists (
    select 1 from snoozer.stripe_webhook_receipts
    where event_id = p_event and object_id = p_session and event_type = 'checkout.session.expired'
  ) then return; end if;
  update snoozer.stripe_sandbox_checkout_attempts
  set expired_at = now()
  where session_id = p_session and customer_id = p_customer and owner_id = p_owner
    and subscription_id is null and expired_at is null
  returning * into attempt;
  if not found then return; end if;

  insert into snoozer.stripe_sandbox_expired_checkouts(session_id, attempt_id, owner_id, price_id, expired_at)
  values (attempt.session_id, attempt.id, attempt.owner_id, attempt.price_id, attempt.expired_at);
end
$$;
revoke execute on function public.mark_stripe_sandbox_checkout_expired(text,text,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_stripe_sandbox_checkout_expired(text,text,text,uuid) to service_role;

create or replace function public.prepare_stripe_sandbox_checkout(p_owner uuid, p_plan text, p_interval text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
  offer snoozer.stripe_sandbox_prices;
begin
  if not exists (select 1 from auth.users where id = p_owner and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;

  select * into attempt from snoozer.stripe_sandbox_checkout_attempts where owner_id = p_owner;
  if not found or attempt.expired_at is not null then
    insert into snoozer.stripe_sandbox_checkout_attempts as a(owner_id, price_id)
    select p_owner, price_id from public.resolve_stripe_sandbox_price(p_plan, p_interval)
    on conflict (owner_id) do update
      set id = excluded.id, price_id = excluded.price_id, created_at = excluded.created_at,
          session_id = null, expired_at = null
      where a.expired_at is not null and a.subscription_id is null;
    select * into attempt from snoozer.stripe_sandbox_checkout_attempts where owner_id = p_owner;
  end if;

  select * into offer from snoozer.stripe_sandbox_prices where price_id = attempt.price_id;
  if not found or offer.plan <> p_plan or offer.billing_interval <> p_interval or attempt.expired_at is not null
      or (attempt.session_id is null and now() >= attempt.created_at + interval '30 minutes') then
    return null;
  end if;

  return jsonb_build_object('id', attempt.id, 'priceId', offer.price_id, 'amount', offer.unit_amount,
    'customerId', attempt.customer_id, 'sessionId', attempt.session_id,
    'expires', extract(epoch from attempt.created_at + interval '2 hours')::bigint);
end
$$;

-- A completed event and an expiry may race. Keep the first verified terminal state.
create or replace function public.bind_stripe_sandbox_subscription(
  p_event text, p_session text, p_customer text, p_owner uuid, p_subscription text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  receipt snoozer.stripe_webhook_receipts;
begin
  select * into receipt from snoozer.stripe_webhook_receipts
  where event_id = p_event and object_id = p_session
    and event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
  for update;
  if not found or p_subscription is null then return false; end if;

  update snoozer.stripe_sandbox_checkout_attempts
  set subscription_id = p_subscription
  where session_id = p_session and customer_id = p_customer and owner_id = p_owner and expired_at is null
    and (subscription_id is null or subscription_id = p_subscription);
  if not found then return false; end if;

  update snoozer.stripe_webhook_receipts set bound_at = now()
  where event_id = p_event and bound_at is null;
  return true;
end
$$;
