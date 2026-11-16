alter table snoozer.stripe_sandbox_checkout_attempts
  add column subscription_id text unique check (subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  add check (subscription_id is null or session_id is not null);

alter table snoozer.stripe_webhook_receipts add column bound_at timestamptz;

create function public.stripe_sandbox_checkout_for_receipt(p_event text)
returns table(session_id text, customer_id text, owner_id uuid)
language sql stable security definer set search_path = '' as $$
  select a.session_id, a.customer_id, a.owner_id
  from snoozer.stripe_webhook_receipts r
  join snoozer.stripe_sandbox_checkout_attempts a on a.session_id = r.object_id
  where r.event_id = p_event and r.bound_at is null
    and r.event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
$$;

create function public.bind_stripe_sandbox_subscription(
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
  where session_id = p_session and customer_id = p_customer and owner_id = p_owner
    and (subscription_id is null or subscription_id = p_subscription);
  if not found then return false; end if;

  update snoozer.stripe_webhook_receipts set bound_at = now()
  where event_id = p_event and bound_at is null;
  return true;
end
$$;

revoke execute on function public.stripe_sandbox_checkout_for_receipt(text),
  public.bind_stripe_sandbox_subscription(text,text,text,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.stripe_sandbox_checkout_for_receipt(text),
  public.bind_stripe_sandbox_subscription(text,text,text,uuid,text) to service_role;
