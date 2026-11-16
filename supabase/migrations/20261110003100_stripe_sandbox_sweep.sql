alter table snoozer.stripe_sandbox_checkout_attempts
  add column next_sweep_at timestamptz not null default '-infinity';

create index stripe_sandbox_checkout_sweep on snoozer.stripe_sandbox_checkout_attempts(next_sweep_at, id)
  where subscription_id is not null;

create function public.claim_stripe_sandbox_sweep()
returns table(subscription_id text) language sql security definer set search_path = '' as $$
  with due as (
    select a.id from snoozer.stripe_sandbox_checkout_attempts a
    where a.subscription_id is not null and a.next_sweep_at <= now()
    order by a.next_sweep_at, a.id
    limit 5 for update skip locked
  )
  update snoozer.stripe_sandbox_checkout_attempts a
  set next_sweep_at = now() + interval '15 minutes'
  from due where a.id = due.id
  returning a.subscription_id
$$;

create function public.sweep_stripe_sandbox_grant(
  p_subscription text, p_customer text, p_price text, p_revision integer,
  p_starts timestamptz, p_ends timestamptz, p_invoice text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  prior snoozer.entitlement_grants;
  current_grant snoozer.entitlement_grants;
  grant_ref text := 'sandbox:' || p_subscription;
begin
  perform 1 from snoozer.stripe_sandbox_checkout_attempts
  where subscription_id = p_subscription and reconciliation_revision = p_revision for update;
  if not found then return 'retry'; end if;

  select * into prior from snoozer.entitlement_grants where source = 'stripe' and source_ref = grant_ref;
  if not public.apply_stripe_sandbox_reconciliation(
    p_subscription, p_customer, p_price, p_revision, p_starts, p_ends, p_invoice
  ) then return 'retry'; end if;
  select * into current_grant from snoozer.entitlement_grants where source = 'stripe' and source_ref = grant_ref;
  if prior is distinct from current_grant then return 'changed'; end if;
  return 'unchanged';
end
$$;

revoke execute on function public.claim_stripe_sandbox_sweep(),
  public.sweep_stripe_sandbox_grant(text,text,text,integer,timestamptz,timestamptz,text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_stripe_sandbox_sweep(),
  public.sweep_stripe_sandbox_grant(text,text,text,integer,timestamptz,timestamptz,text) to service_role;
