alter table snoozer.stripe_sandbox_checkout_attempts
  add column reconciliation_revision integer not null default 0;

create function public.start_stripe_sandbox_reconciliation(p_subscription text)
returns table(customer_id text, price_id text, revision integer)
language sql security definer set search_path = '' as $$
  update snoozer.stripe_sandbox_checkout_attempts a
  set reconciliation_revision = a.reconciliation_revision + 1
  where a.subscription_id = p_subscription
  returning a.customer_id, a.price_id, a.reconciliation_revision
$$;

create function public.apply_stripe_sandbox_reconciliation(
  p_subscription text, p_customer text, p_price text, p_revision integer,
  p_starts timestamptz, p_ends timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  attempt snoozer.stripe_sandbox_checkout_attempts;
  offer snoozer.stripe_sandbox_prices;
  grant_ref text := 'sandbox:' || p_subscription;
begin
  select * into attempt from snoozer.stripe_sandbox_checkout_attempts
  where subscription_id = p_subscription and customer_id = p_customer
    and price_id = p_price and reconciliation_revision = p_revision
  for update;
  if not found then return false; end if;

  if p_starts is not null and p_ends > now() and p_starts <= now() then
    select * into strict offer from snoozer.stripe_sandbox_prices where price_id = attempt.price_id;
    insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
    values (attempt.owner_id,offer.plan,offer.plan_version,'stripe',grant_ref,p_starts,p_ends)
    on conflict (source,source_ref) do update
      set starts_at = excluded.starts_at, expires_at = excluded.expires_at, revoked_at = null
      where snoozer.entitlement_grants.owner_id = excluded.owner_id;
  else
    update snoozer.entitlement_grants set revoked_at = now()
    where source = 'stripe' and source_ref = grant_ref and owner_id = attempt.owner_id and revoked_at is null;
  end if;

  update snoozer.stripe_sandbox_checkout_attempts
  set reconciliation_revision = reconciliation_revision + 1 where id = attempt.id;
  return true;
end
$$;

revoke execute on function public.start_stripe_sandbox_reconciliation(text),
  public.apply_stripe_sandbox_reconciliation(text,text,text,integer,timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.start_stripe_sandbox_reconciliation(text),
  public.apply_stripe_sandbox_reconciliation(text,text,text,integer,timestamptz,timestamptz) to service_role;

-- Keep bound receipts resolvable when an earlier request bound the subscription
-- successfully but failed to reconcile the plan.
create or replace function public.stripe_sandbox_checkout_for_receipt(p_event text)
returns table(session_id text, customer_id text, owner_id uuid)
language sql stable security definer set search_path = '' as $$
  select a.session_id, a.customer_id, a.owner_id
  from snoozer.stripe_webhook_receipts r
  join snoozer.stripe_sandbox_checkout_attempts a on a.session_id = r.object_id
  where r.event_id = p_event
    and r.event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
$$;
