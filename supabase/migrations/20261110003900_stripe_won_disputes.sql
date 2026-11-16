alter table snoozer.stripe_sandbox_invoice_holds
  drop constraint stripe_sandbox_invoice_holds_pkey,
  add primary key (invoice_id,event_id),
  add column legacy boolean not null default true,
  add column released_at timestamptz;
alter table snoozer.stripe_sandbox_invoice_holds alter column legacy set default false;

create table snoozer.stripe_sandbox_won_disputes (
  dispute_id text primary key check (dispute_id ~ '^du_[A-Za-z0-9]{1,128}$'),
  event_id text not null references snoozer.stripe_webhook_receipts(event_id),
  recorded_at timestamptz not null default now()
);
alter table snoozer.stripe_sandbox_won_disputes enable row level security;
revoke all on snoozer.stripe_sandbox_won_disputes from public, anon, authenticated, service_role;

create or replace function public.record_stripe_sandbox_invoice_hold(
  p_event text, p_invoice text, p_subscription text, p_customer text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  receipt snoozer.stripe_webhook_receipts;
begin
  select * into receipt from snoozer.stripe_webhook_receipts where event_id=p_event;
  if not found then return; end if;
  if receipt.event_type in ('charge.dispute.created','charge.dispute.closed') then
    perform pg_advisory_xact_lock(hashtextextended('sandbox-dispute:' || receipt.object_id,0));
    if exists (select 1 from snoozer.stripe_sandbox_won_disputes where dispute_id=receipt.object_id) then return; end if;
  elsif receipt.event_type not in ('charge.refunded','radar.early_fraud_warning.created') then
    return;
  end if;
  insert into snoozer.stripe_sandbox_invoice_holds(invoice_id,subscription_id,customer_id,event_id)
  values (p_invoice,p_subscription,p_customer,p_event) on conflict (invoice_id,event_id) do nothing;
end
$$;

create function public.release_stripe_sandbox_invoice_dispute(p_event text,p_dispute text)
returns table(subscription_id text) language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from snoozer.stripe_webhook_receipts
    where event_id=p_event and object_id=p_dispute and event_type='charge.dispute.closed'
  ) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('sandbox-dispute:' || p_dispute,0));
  insert into snoozer.stripe_sandbox_won_disputes(dispute_id,event_id) values (p_dispute,p_event)
  on conflict (dispute_id) do nothing;
  update snoozer.stripe_sandbox_invoice_holds h set released_at=now()
  from snoozer.stripe_webhook_receipts r
  where r.event_id=h.event_id and r.object_id=p_dispute
    and r.event_type in ('charge.dispute.created','charge.dispute.closed')
    and not h.legacy and h.released_at is null;
  return query
    select distinct h.subscription_id from snoozer.stripe_sandbox_invoice_holds h
    join snoozer.stripe_webhook_receipts r on r.event_id=h.event_id
    where r.object_id=p_dispute and r.event_type in ('charge.dispute.created','charge.dispute.closed')
      and h.released_at is not null;
end
$$;
revoke execute on function public.release_stripe_sandbox_invoice_dispute(text,text) from public,anon,authenticated,service_role;
grant execute on function public.release_stripe_sandbox_invoice_dispute(text,text) to service_role;

create or replace function public.apply_stripe_sandbox_reconciliation(
  p_subscription text, p_customer text, p_price text, p_revision integer,
  p_starts timestamptz, p_ends timestamptz, p_invoice text
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

  if p_starts is not null and p_ends > now() and p_starts <= now()
    and p_invoice ~ '^in_[A-Za-z0-9]{1,128}$'
    and not exists (
      select 1 from snoozer.stripe_sandbox_invoice_holds h
      where h.invoice_id = p_invoice and h.subscription_id = p_subscription and h.customer_id = p_customer and h.released_at is null
    ) then
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

create or replace function public.record_stripe_sandbox_event(p_id text, p_type text, p_object text, p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
begin
  prefix := case
    when p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired') then 'cs_test_'
    when p_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then 'sub_'
    when p_type in ('invoice.paid', 'invoice.payment_failed') then 'in_'
    when p_type = 'charge.refunded' then 'ch_'
    when p_type in ('charge.dispute.created','charge.dispute.closed') then 'du_'
    when p_type = 'radar.early_fraud_warning.created' then 'issfr_'
  end;
  if prefix is null or p_object is null or p_object !~ ('^' || prefix || '[A-Za-z0-9]{1,128}$') then
    raise exception 'Invalid Stripe event object' using errcode = '22023';
  end if;

  insert into snoozer.stripe_webhook_receipts(event_id, event_type, object_id, occurred_at)
  values (p_id, p_type, p_object, p_occurred_at)
  on conflict (event_id) do nothing;
end
$$;

create or replace function public.get_billing_diagnostics()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stripeSandbox', jsonb_build_object(
      'linkedSubscriptions', (select count(*) from snoozer.stripe_sandbox_checkout_attempts where subscription_id is not null),
      'staleUnboundAttempts', (select count(*) from snoozer.stripe_sandbox_checkout_attempts
        where session_id is null and expired_at is null and created_at <= now()-interval '2 hours 5 minutes'),
      'unboundCompletionReceipts', (select count(*) from snoozer.stripe_webhook_receipts
        where event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and bound_at is null),
      'heldInvoices', (select count(distinct invoice_id) from snoozer.stripe_sandbox_invoice_holds where released_at is null),
      'endedSubscriptions', (select count(*) from snoozer.stripe_sandbox_ended_subscriptions)
    ),
    'kofi', jsonb_build_object(
      'unclaimedReceipts', (select count(*) from snoozer.kofi_donation_receipts where claimed_at is null),
      'pendingReviews', (select count(*) from snoozer.kofi_donation_reviews where status = 'pending')
    ),
    'gifts', jsonb_build_object(
      'redeemableCodes', (select count(*) from snoozer.gift_codes
        where revoked_at is null and redeemed_at is null and expires_at > now()),
      'activeGrants', (select count(*) from snoozer.entitlement_grants
        where source = 'gift' and revoked_at is null and starts_at <= now() and expires_at > now())
    )
  )
$$;

create or replace function public.hold_stripe_sandbox_gift_payment(p_event text,p_payment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  issued uuid;
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  insert into snoozer.stripe_sandbox_gift_payment_holds(payment_id,event_id)
  select p_payment,event_id from snoozer.stripe_webhook_receipts
  where event_id=p_event and event_type in ('charge.refunded','charge.dispute.created','charge.dispute.closed','radar.early_fraud_warning.created')
  on conflict (payment_id) do nothing;
  if not found then return; end if;
  select gift_id into issued from snoozer.stripe_sandbox_gift_orders where payment_id=p_payment;
  if issued is not null then perform public.revoke_gift_code(issued); end if;
end
$$;
