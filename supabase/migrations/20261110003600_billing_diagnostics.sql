create function public.get_billing_diagnostics()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stripeSandbox', jsonb_build_object(
      'linkedSubscriptions', (select count(*) from snoozer.stripe_sandbox_checkout_attempts where subscription_id is not null),
      'staleUnboundAttempts', (select count(*) from snoozer.stripe_sandbox_checkout_attempts
        where session_id is null and expired_at is null and created_at <= now()-interval '2 hours 5 minutes'),
      'unboundCompletionReceipts', (select count(*) from snoozer.stripe_webhook_receipts
        where event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and bound_at is null),
      'heldInvoices', (select count(*) from snoozer.stripe_sandbox_invoice_holds),
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
revoke execute on function public.get_billing_diagnostics() from public, anon, authenticated, service_role;
grant execute on function public.get_billing_diagnostics() to service_role;
