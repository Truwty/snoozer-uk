create table snoozer.stripe_sandbox_prices (
  price_id text primary key check (price_id ~ '^price_[A-Za-z0-9]{1,128}$'),
  plan text not null check (plan <> 'free'),
  plan_version integer not null,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  currency text not null check (currency = 'gbp'),
  unit_amount integer not null check (unit_amount > 0),
  retired_at timestamptz,
  foreign key (plan, plan_version) references snoozer.plan_versions(plan, version)
);

create unique index stripe_sandbox_prices_current_offer
  on snoozer.stripe_sandbox_prices (plan, billing_interval, currency) where retired_at is null;

alter table snoozer.stripe_sandbox_prices enable row level security;
revoke all on snoozer.stripe_sandbox_prices from public, anon, authenticated, service_role;

create function public.resolve_stripe_sandbox_price(p_plan text, p_interval text)
returns table(price_id text, plan_version integer, currency text, unit_amount integer)
language sql stable security definer set search_path = '' as $$
  select p.price_id, p.plan_version, p.currency, p.unit_amount
  from snoozer.stripe_sandbox_prices p
  where p.plan = p_plan and p.billing_interval = p_interval and p.retired_at is null
$$;

revoke execute on function public.resolve_stripe_sandbox_price(text,text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_stripe_sandbox_price(text,text) to service_role;
