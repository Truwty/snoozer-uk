create function public.list_stripe_sandbox_preflight_offers()
returns table(price_id text, amount_pence integer, billing_interval text)
language sql stable security definer set search_path = '' as $$
  select p.price_id, p.unit_amount, p.billing_interval
  from snoozer.stripe_sandbox_prices p where p.retired_at is null
  union all
  select g.price_id, g.amount_pence, null::text
  from snoozer.stripe_sandbox_gift_offers g where g.retired_at is null
$$;
revoke execute on function public.list_stripe_sandbox_preflight_offers() from public, anon, authenticated, service_role;
grant execute on function public.list_stripe_sandbox_preflight_offers() to service_role;
