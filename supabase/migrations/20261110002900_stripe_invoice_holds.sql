create table snoozer.stripe_sandbox_invoice_holds (
  invoice_id text primary key check (invoice_id ~ '^in_[A-Za-z0-9]{1,128}$'),
  subscription_id text not null check (subscription_id ~ '^sub_[A-Za-z0-9]{1,128}$'),
  customer_id text not null check (customer_id ~ '^cus_[A-Za-z0-9]{1,128}$'),
  event_id text not null references snoozer.stripe_webhook_receipts(event_id),
  created_at timestamptz not null default now()
);
alter table snoozer.stripe_sandbox_invoice_holds enable row level security;
revoke all on snoozer.stripe_sandbox_invoice_holds from public, anon, authenticated, service_role;

create function public.record_stripe_sandbox_invoice_hold(
  p_event text, p_invoice text, p_subscription text, p_customer text
) returns void language sql security definer set search_path = '' as $$
  insert into snoozer.stripe_sandbox_invoice_holds(invoice_id, subscription_id, customer_id, event_id)
  select p_invoice, p_subscription, p_customer, event_id
  from snoozer.stripe_webhook_receipts
  where event_id = p_event and event_type in ('charge.refunded','charge.dispute.created','radar.early_fraud_warning.created')
  on conflict (invoice_id) do nothing
$$;

drop function public.apply_stripe_sandbox_reconciliation(text,text,text,integer,timestamptz,timestamptz);
create function public.apply_stripe_sandbox_reconciliation(
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
      where h.invoice_id = p_invoice and h.subscription_id = p_subscription and h.customer_id = p_customer
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

revoke execute on function public.record_stripe_sandbox_invoice_hold(text,text,text,text),
  public.apply_stripe_sandbox_reconciliation(text,text,text,integer,timestamptz,timestamptz,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_stripe_sandbox_invoice_hold(text,text,text,text),
  public.apply_stripe_sandbox_reconciliation(text,text,text,integer,timestamptz,timestamptz,text) to service_role;
