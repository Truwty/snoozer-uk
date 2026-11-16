create function public.get_my_stripe_sandbox_customer()
returns text language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select a.customer_id
  from actor join snoozer.stripe_sandbox_checkout_attempts a on a.owner_id = actor.id
  where a.subscription_id is not null
$$;

revoke execute on function public.get_my_stripe_sandbox_customer() from public, anon, authenticated, service_role;
grant execute on function public.get_my_stripe_sandbox_customer() to authenticated;
