create table snoozer.stripe_sandbox_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  price_id text not null references snoozer.stripe_sandbox_prices(price_id),
  customer_id text unique check (customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
  session_id text unique check (session_id ~ '^cs_test_[A-Za-z0-9]{1,128}$'),
  created_at timestamptz not null default date_trunc('second', now()),
  check (session_id is null or customer_id is not null)
);

alter table snoozer.stripe_sandbox_checkout_attempts enable row level security;
revoke all on snoozer.stripe_sandbox_checkout_attempts from public, anon, authenticated, service_role;

create function public.prepare_stripe_sandbox_checkout(p_owner uuid, p_plan text, p_interval text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
  offer snoozer.stripe_sandbox_prices;
begin
  if not exists (select 1 from auth.users where id = p_owner and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;

  select * into attempt from snoozer.stripe_sandbox_checkout_attempts where owner_id = p_owner;
  if not found then
    insert into snoozer.stripe_sandbox_checkout_attempts(owner_id, price_id)
    select p_owner, price_id from public.resolve_stripe_sandbox_price(p_plan, p_interval)
    on conflict (owner_id) do nothing;
    select * into attempt from snoozer.stripe_sandbox_checkout_attempts where owner_id = p_owner;
  end if;

  select * into offer from snoozer.stripe_sandbox_prices where price_id = attempt.price_id;
  if not found or offer.plan <> p_plan or offer.billing_interval <> p_interval
      or (attempt.session_id is null and now() >= attempt.created_at + interval '30 minutes') then
    return null;
  end if;

  return jsonb_build_object('id', attempt.id, 'priceId', offer.price_id, 'amount', offer.unit_amount,
    'customerId', attempt.customer_id, 'sessionId', attempt.session_id,
    'expires', extract(epoch from attempt.created_at + interval '2 hours')::bigint);
end
$$;

create function public.bind_stripe_sandbox_checkout(p_owner uuid, p_attempt uuid, p_customer text, p_session text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_customer is null then return false; end if;

  update snoozer.stripe_sandbox_checkout_attempts
  set customer_id = p_customer, session_id = coalesce(session_id, p_session)
  where id = p_attempt and owner_id = p_owner
    and (customer_id is null or customer_id = p_customer)
    and (p_session is null or (customer_id = p_customer and (session_id is null or session_id = p_session)));
  return found;
end
$$;

revoke execute on function public.prepare_stripe_sandbox_checkout(uuid,text,text),
  public.bind_stripe_sandbox_checkout(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.prepare_stripe_sandbox_checkout(uuid,text,text),
  public.bind_stripe_sandbox_checkout(uuid,uuid,text,text) to service_role;
