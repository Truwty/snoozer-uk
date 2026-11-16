alter table snoozer.gift_codes add column payment_held boolean not null default false;
alter table snoozer.entitlement_grants add column payment_held boolean not null default false;
alter table snoozer.stripe_sandbox_gift_payment_holds
  drop constraint stripe_sandbox_gift_payment_holds_pkey,
  add primary key (payment_id,event_id),
  add column legacy boolean not null default true,
  add column released_at timestamptz;
alter table snoozer.stripe_sandbox_gift_payment_holds alter column legacy set default false;

create function snoozer.sync_stripe_sandbox_gift_hold(p_payment text)
returns void language plpgsql set search_path = '' as $$
declare
  issued uuid;
  held boolean;
begin
  select gift_id into issued from snoozer.stripe_sandbox_gift_orders where payment_id=p_payment;
  if issued is null then return; end if;
  select exists (
    select 1 from snoozer.stripe_sandbox_gift_payment_holds where payment_id=p_payment and released_at is null
  ) into held;
  update snoozer.gift_codes set payment_held=held where id=issued;
  update snoozer.entitlement_grants set payment_held=held where source='gift' and source_ref=issued::text;
end
$$;

create or replace function public.hold_stripe_sandbox_gift_payment(p_event text,p_payment text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  receipt snoozer.stripe_webhook_receipts;
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return; end if;
  select * into receipt from snoozer.stripe_webhook_receipts where event_id=p_event;
  if not found then return; end if;
  if receipt.event_type in ('charge.dispute.created','charge.dispute.closed') then
    perform pg_advisory_xact_lock(hashtextextended('sandbox-dispute:' || receipt.object_id,0));
    if exists (select 1 from snoozer.stripe_sandbox_won_disputes where dispute_id=receipt.object_id) then return; end if;
  elsif receipt.event_type not in ('charge.refunded','radar.early_fraud_warning.created') then return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  insert into snoozer.stripe_sandbox_gift_payment_holds(payment_id,event_id)
  values (p_payment,p_event) on conflict (payment_id,event_id) do nothing;
  perform snoozer.sync_stripe_sandbox_gift_hold(p_payment);
end
$$;

create function public.release_stripe_sandbox_gift_dispute(p_event text,p_dispute text,p_payment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return; end if;
  if not exists (
    select 1 from snoozer.stripe_webhook_receipts
    where event_id=p_event and object_id=p_dispute and event_type='charge.dispute.closed'
  ) then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('sandbox-dispute:' || p_dispute,0));
  insert into snoozer.stripe_sandbox_won_disputes(dispute_id,event_id) values (p_dispute,p_event)
  on conflict (dispute_id) do nothing;
  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  update snoozer.stripe_sandbox_gift_payment_holds h set released_at=now()
  from snoozer.stripe_webhook_receipts r
  where r.event_id=h.event_id and r.object_id=p_dispute and h.payment_id=p_payment
    and r.event_type in ('charge.dispute.created','charge.dispute.closed')
    and not h.legacy and h.released_at is null;
  perform snoozer.sync_stripe_sandbox_gift_hold(p_payment);
end
$$;
revoke execute on function snoozer.sync_stripe_sandbox_gift_hold(text),
  public.release_stripe_sandbox_gift_dispute(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.release_stripe_sandbox_gift_dispute(text,text,text) to service_role;

create or replace function public.get_my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id),
    selected as (
      select g.plan, g.plan_version, g.expires_at
      from actor join snoozer.entitlement_grants g on g.owner_id = actor.id
      where g.revoked_at is null and not g.payment_held and g.starts_at <= now() and g.expires_at > now()
      order by case g.plan when 'studio' then 3 when 'pro' then 2 else 1 end desc,
        g.plan_version desc, g.expires_at desc, g.id
      limit 1
    )
  select jsonb_build_object(
    'plan', p.plan,
    'version', p.version,
    'quotas', jsonb_build_object(
      'profiles', p.profiles, 'links', p.links, 'mediaBytes', p.media_bytes,
      'domains', p.domains, 'aliases', p.aliases, 'analyticsDays', p.analytics_days, 'teamSeats', p.team_seats
    ),
    'capabilities', jsonb_build_object(
      'premiumLayouts', p.premium_layouts, 'advancedEffects', p.advanced_effects,
      'scheduledPublishing', p.scheduled_publishing, 'abTesting', p.ab_testing,
      'removeBranding', p.remove_branding, 'advancedSeo', p.advanced_seo,
      'prioritySupport', p.priority_support, 'apiAccess', p.api_access
    ),
    'expiresAt', selected.expires_at,
    'usage', jsonb_build_object(
      'publishedProfiles', (select count(*) from snoozer.profiles where owner_id = actor.id and published_revision is not null),
      'draftLinks', (select count(*) from snoozer.links where owner_id = actor.id)
    )
  )
  from actor left join selected on true
  join snoozer.plan_versions p on p.plan = coalesce(selected.plan, 'free')
    and p.version = coalesce(selected.plan_version, (select max(version) from snoozer.plan_versions where plan = 'free'))
$$;

create or replace function public.redeem_gift_code(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  token text := lower(btrim(p_code));
  gift snoozer.gift_codes;
  redeemed timestamptz;
begin
  if token is null or token !~ '^[a-f0-9]{32}$' then return false; end if;
  select * into gift from snoozer.gift_codes
  where code_hash = sha256(convert_to(token,'UTF8')) for update;
  if not found then return false; end if;
  redeemed := clock_timestamp();
  if gift.redeemed_at is not null or gift.revoked_at is not null or gift.payment_held or gift.expires_at <= redeemed then
    return false;
  end if;
  update snoozer.gift_codes set redeemed_at = redeemed where id = gift.id;
  insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
  values (actor,gift.plan,gift.plan_version,'gift',gift.id::text,redeemed,redeemed+gift.duration_days*interval '24 hours');
  return true;
end
$$;

create or replace function public.fulfill_stripe_sandbox_gift(
  p_event text,p_buyer uuid,p_order uuid,p_session text,p_payment text,p_price text,p_amount integer,p_code_hash bytea
) returns text language plpgsql security definer set search_path = '' as $$
declare
  gift_order snoozer.stripe_sandbox_gift_orders;
  offer snoozer.stripe_sandbox_gift_offers;
  issued uuid;
begin
  if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]{1,128}$' then return 'unmatched'; end if;
  if not exists (
    select 1 from snoozer.stripe_webhook_receipts where event_id=p_event and object_id=p_session
    and event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
  ) then return 'unmatched'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sandbox-gift:' || p_payment,0));
  select * into gift_order from snoozer.stripe_sandbox_gift_orders
  where id=p_order and buyer_id=p_buyer and session_id=p_session for update;
  if not found then return 'unmatched'; end if;
  select * into strict offer from snoozer.stripe_sandbox_gift_offers where id=gift_order.offer_id;
  if offer.price_id is distinct from p_price or offer.amount_pence is distinct from p_amount then return 'unmatched'; end if;
  if exists (select 1 from snoozer.stripe_sandbox_gift_payment_holds where payment_id=p_payment and released_at is null) then return 'held'; end if;
  if gift_order.gift_id is not null then
    if gift_order.payment_id=p_payment then return 'fulfilled'; end if;
    return 'unmatched';
  end if;

  insert into snoozer.gift_codes(code_hash,plan,plan_version,duration_days,expires_at)
  values (p_code_hash,offer.plan,offer.plan_version,offer.duration_days,now()+interval '365 days')
  returning id into issued;
  update snoozer.stripe_sandbox_gift_orders set payment_id=p_payment,gift_id=issued where id=p_order;
  return 'fulfilled';
end
$$;

create or replace function public.list_my_stripe_sandbox_gifts()
returns table(order_id uuid,plan text,status text,code_hash text)
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select g.id,o.plan,case
    when c.revoked_at is not null then 'revoked'
    when c.payment_held then 'held'
    when c.redeemed_at is not null then 'redeemed'
    when c.expires_at <= now() then 'expired'
    else 'ready'
  end,
  case when c.revoked_at is null and not c.payment_held and c.redeemed_at is null and c.expires_at > now()
    then encode(c.code_hash,'hex') end
  from actor join snoozer.stripe_sandbox_gift_orders g on g.buyer_id=actor.id
  join snoozer.stripe_sandbox_gift_offers o on o.id=g.offer_id
  join snoozer.gift_codes c on c.id=g.gift_id
  order by g.created_at desc,g.id limit 30
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
        where revoked_at is null and not payment_held and redeemed_at is null and expires_at > now()),
      'activeGrants', (select count(*) from snoozer.entitlement_grants
        where source = 'gift' and revoked_at is null and not payment_held and starts_at <= now() and expires_at > now())
    )
  )
$$;
