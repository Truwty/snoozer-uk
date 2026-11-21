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
