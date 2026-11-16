create table snoozer.stripe_sandbox_ended_subscriptions (
  subscription_id text primary key,
  session_id text not null unique,
  attempt_id uuid not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  price_id text not null references snoozer.stripe_sandbox_prices(price_id),
  terminal_status text not null check (terminal_status in ('canceled','incomplete_expired')),
  recorded_at timestamptz not null default now()
);
alter table snoozer.stripe_sandbox_ended_subscriptions enable row level security;
revoke all on snoozer.stripe_sandbox_ended_subscriptions from public, anon, authenticated, service_role;

create function public.end_stripe_sandbox_subscription(
  p_subscription text, p_customer text, p_revision integer, p_status text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
  revoked boolean;
begin
  if p_status is null or p_status not in ('canceled','incomplete_expired') then return 'retry'; end if;
  select * into attempt from snoozer.stripe_sandbox_checkout_attempts
  where subscription_id = p_subscription and customer_id = p_customer
    and reconciliation_revision = p_revision and expired_at is null
  for update;
  if not found then return 'retry'; end if;

  insert into snoozer.stripe_sandbox_ended_subscriptions(
    subscription_id,session_id,attempt_id,owner_id,customer_id,price_id,terminal_status
  ) values (p_subscription,attempt.session_id,attempt.id,attempt.owner_id,p_customer,attempt.price_id,p_status);
  update snoozer.entitlement_grants set revoked_at = now()
  where owner_id = attempt.owner_id and source = 'stripe' and source_ref = 'sandbox:' || p_subscription
    and revoked_at is null;
  revoked := found;

  update snoozer.stripe_sandbox_checkout_attempts
  set subscription_id = null, expired_at = now(), reconciliation_revision = reconciliation_revision + 1,
      next_sweep_at = '-infinity'
  where id = attempt.id;
  if revoked then return 'changed'; end if;
  return 'unchanged';
end
$$;
revoke execute on function public.end_stripe_sandbox_subscription(text,text,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.end_stripe_sandbox_subscription(text,text,integer,text) to service_role;

create or replace function public.get_my_stripe_sandbox_customer()
returns text language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select a.customer_id
  from actor join snoozer.stripe_sandbox_checkout_attempts a on a.owner_id = actor.id
  where a.subscription_id is not null or exists (
    select 1 from snoozer.stripe_sandbox_ended_subscriptions h
    where h.owner_id = a.owner_id and h.customer_id = a.customer_id
  )
$$;
