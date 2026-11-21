-- Snoozer exclusively sells its own Premium subscriptions.
-- Stripe Tax remains OFF until separately configured; this does not waive any tax obligations.
-- Historical creator marketplace transactions must be preserved for audit.
create or replace function public.list_premium_live_offers()
returns table(price_id text,plan text,plan_version integer,billing_interval text,currency text,unit_amount integer)
language sql stable security definer set search_path = '' as $$
  select p.price_id,p.plan,p.plan_version,p.billing_interval,p.currency,p.unit_amount
  from snoozer.premium_live_prices p
  join snoozer.premium_live_policy k on k.singleton=true
  where k.checkout_enabled and k.legal_reviewed
    and p.retired_at is null order by p.unit_amount,p.price_id
$$;

create or replace function public.prepare_premium_live_checkout(p_owner uuid,p_price text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  offer snoozer.premium_live_prices;
  attempt snoozer.premium_live_checkouts;
  cid text;
begin
  -- Avoid a second session for the same verified account, including racing requests.
  perform 1 from auth.users where id=p_owner and email_confirmed_at is not null for update;
  if not found then raise exception 'Verified account required' using errcode='42501'; end if;
  if not exists(select 1 from snoozer.premium_live_policy where singleton
    and checkout_enabled and legal_reviewed) then return null; end if;
  select * into offer from snoozer.premium_live_prices
    where price_id=p_price and retired_at is null;
  if not found then return null; end if;
  select customer_id into cid from snoozer.premium_live_customers where owner_id=p_owner;
  select * into attempt from snoozer.premium_live_checkouts
    where owner_id=p_owner and status in ('reserved','pending','bound') for update;
  if found then
    if attempt.status='bound' or attempt.price_id<>p_price
      or attempt.expires_at<=now() then return null; end if;
  else
    insert into snoozer.premium_live_checkouts(owner_id,price_id)
    values(p_owner,p_price) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'priceId',attempt.price_id,
    'amount',offer.unit_amount,'interval',offer.billing_interval,
    'customerId',cid,'sessionId',attempt.session_id,
    'expires',extract(epoch from attempt.expires_at)::bigint);
end $$;


-- Freeze all legacy seller payment policies, including direct service-role writes.
update snoozer.creator_sandbox_policy set enabled=false where enabled;
update snoozer.creator_membership_policy set enabled=false where enabled;
update snoozer.creator_sandbox_offers set enabled=false where enabled;
update snoozer.creator_kofi_hooks set enabled=false where enabled;

alter table snoozer.creator_sandbox_policy
  add constraint snoozer_retired_creator_checkout_off check (enabled=false);
alter table snoozer.creator_membership_policy
  add constraint snoozer_retired_creator_membership_off check (enabled=false);
alter table snoozer.creator_sandbox_offers
  add constraint snoozer_retired_creator_offers_off check (enabled=false);
alter table snoozer.creator_kofi_hooks
  add constraint snoozer_retired_creator_tips_off check (enabled=false);

-- No user, guest or server may invoke the retired marketplace's service API.
-- Do not drop the functions or financial tables: existing audit evidence is preserved.
do $retire$
declare f record;
begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname ~* '(creator|product|membership|purchase|seller|storefront|discount|version|inventory|stock|quarantine)'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', f.signature);
  end loop;
end $retire$;

-- Prevent a different paid Stripe Price from silently reassigning a subscribed user
-- to another Premium tier. A change of tier requires an explicit verified flow.
create or replace function public.apply_premium_live_reconciliation(
  p_subscription text,p_customer text,p_revision integer,
  p_stripe_status text,p_price text,p_invoice text,
  p_starts timestamptz,p_ends timestamptz,p_verified_paid boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare attempt snoozer.premium_live_checkouts;
declare offer snoozer.premium_live_prices;
declare gr text := 'live:'||p_subscription;
declare is_eligible boolean := false;
begin
  select * into attempt from snoozer.premium_live_checkouts a
  where a.subscription_id=p_subscription and a.status='bound'
    and a.reconciliation_revision=p_revision
    and exists(select 1 from snoozer.premium_live_customers c
      where c.owner_id=a.owner_id and c.customer_id=p_customer)
  for update;
  if not found then return false; end if;
  if p_stripe_status not in ('active','trialing','canceled','incomplete','incomplete_expired','past_due','paused','unpaid')
    then raise exception 'Invalid Stripe subscription status'; end if;
  select * into offer from snoozer.premium_live_prices where price_id=p_price;
  is_eligible := p_stripe_status='active' and p_verified_paid is true
    and found and offer.price_id=attempt.price_id and p_invoice ~ '^in_[A-Za-z0-9]{1,128}$'
    and p_starts<=now() and p_ends>now()
    and not exists(select 1 from snoozer.premium_live_invoice_holds h
       where h.invoice_id=p_invoice and h.subscription_id=p_subscription and h.customer_id=p_customer);
  if is_eligible then
    insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
    values(attempt.owner_id,offer.plan,offer.plan_version,'stripe',gr,p_starts,p_ends)
    on conflict(source,source_ref) do update set
      plan=excluded.plan,plan_version=excluded.plan_version,starts_at=excluded.starts_at,
      expires_at=excluded.expires_at,revoked_at=null
      where snoozer.entitlement_grants.owner_id=excluded.owner_id;
  else
    update snoozer.entitlement_grants set revoked_at=now()
    where source='stripe' and source_ref=gr and owner_id=attempt.owner_id and revoked_at is null;
  end if;
  update snoozer.premium_live_checkouts set
    last_invoice=case when p_invoice ~ '^in_[A-Za-z0-9]{1,128}$' then p_invoice else last_invoice end,
    last_status=p_stripe_status,last_checked_at=now(),
    status=case when p_stripe_status in ('canceled','incomplete_expired') then 'ended' else status end,
    reconciliation_revision=reconciliation_revision+1
  where id=attempt.id;
  return true;
end $$;

