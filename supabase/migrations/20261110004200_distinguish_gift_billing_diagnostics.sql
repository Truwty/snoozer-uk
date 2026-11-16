create index stripe_completion_receipts_by_session
  on snoozer.stripe_webhook_receipts(object_id)
  where event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded');
create or replace function public.get_billing_diagnostics()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stripeSandbox', jsonb_build_object(
      'linkedSubscriptions', (select count(*) from snoozer.stripe_sandbox_checkout_attempts where subscription_id is not null),
      'staleUnboundAttempts', (select count(*) from snoozer.stripe_sandbox_checkout_attempts
        where session_id is null and expired_at is null and created_at <= now()-interval '2 hours 5 minutes'),
      'unboundCompletionReceipts', (select count(*) from snoozer.stripe_webhook_receipts r
        where r.event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
          and r.bound_at is null and not exists (
            select 1 from snoozer.stripe_sandbox_gift_orders g where g.session_id = r.object_id
          )),
      'giftsAwaitingFulfillment', (select count(*) from snoozer.stripe_sandbox_gift_orders g
        where g.gift_id is null and exists (
          select 1 from snoozer.stripe_webhook_receipts r where r.object_id = g.session_id
            and r.event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
        )),
      'heldInvoices', (select count(distinct invoice_id) from snoozer.stripe_sandbox_invoice_holds where released_at is null),
      'endedSubscriptions', (select count(*) from snoozer.stripe_sandbox_ended_subscriptions)
    ),
    'kofi', jsonb_build_object(
      'unclaimedReceipts', (select count(*) from snoozer.kofi_donation_receipts where claimed_at is null),
      'pendingReviews', (select count(*) from snoozer.kofi_donation_reviews where status = 'pending')
    ),
    'gifts', jsonb_build_object(
      'redeemableCodes', (select count(*) from snoozer.gift_codes
        where revoked_at is null and not payment_held and redeemed_at is null and expires_at > now()),
      'activeGrants', (select count(*) from snoozer.entitlement_grants
        where source = 'gift' and revoked_at is null and not payment_held and starts_at <= now() and expires_at > now())
    )
  )
$$;
