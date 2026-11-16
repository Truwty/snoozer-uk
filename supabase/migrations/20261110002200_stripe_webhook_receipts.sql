create table snoozer.stripe_webhook_receipts (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]{1,128}$'),
  event_type text not null,
  object_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

alter table snoozer.stripe_webhook_receipts enable row level security;
revoke all on snoozer.stripe_webhook_receipts from public, anon, authenticated, service_role;

create function public.record_stripe_sandbox_event(p_id text, p_type text, p_object text, p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
begin
  prefix := case
    when p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired') then 'cs_test_'
    when p_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then 'sub_'
    when p_type in ('invoice.paid', 'invoice.payment_failed') then 'in_'
    when p_type = 'charge.refunded' then 'ch_'
    when p_type = 'charge.dispute.created' then 'dp_'
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

revoke execute on function public.record_stripe_sandbox_event(text,text,text,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.record_stripe_sandbox_event(text,text,text,timestamptz) to service_role;
