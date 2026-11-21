begin;

-- Sandbox-only owner statistics from retained orders. No raw buyer identifiers,
-- emails, Stripe tokens or receipts are exposed. This does not represent actual
-- merchant earnings, net refunds, payouts, production sales or tax invoices.
-- Do not make this callable by anon or service_role through the Data API.
create function public.read_my_creator_storefront_analytics(p_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid := snoozer.verified_user();
  report jsonb;
begin
  if p_profile is null or not exists (
    select 1 from snoozer.profiles p where p.id=p_profile and p.owner_id=actor
  ) then
    raise exception 'Creator analytics profile unavailable' using errcode='42501';
  end if;

  with retained as materialized (
    select o.id, o.state, o.holds, o.created_at, o.access_until, v.amount
    from snoozer.creator_sandbox_orders o
    join snoozer.product_versions v on v.id=o.version_id
    where o.profile_id=p_profile and o.seller_id=actor
  ), totals as (
    select
      count(*)::integer as retained_orders,
      count(*) filter (where state='pending')::integer as pending_orders,
      count(*) filter (where state='expired')::integer as expired_orders,
      count(*) filter (where state='paid')::integer as paid_orders,
      count(*) filter (where state='paid' and cardinality(holds)>0)::integer as held_paid_orders,
      count(*) filter (where state='paid' and cardinality(holds)=0 and access_until>now())::integer as downloadable_orders,
      coalesce(sum(amount) filter (where state='paid'),0)::bigint as gross_test_pence
    from retained
  ), daily as (
    select d.day,
      count(r.id)::integer as orders,
      count(r.id) filter (where r.state='paid')::integer as paid,
      coalesce(sum(r.amount) filter (where r.state='paid'),0)::bigint as gross_test_pence
    from generate_series(13,0,-1) as days(i)
    cross join lateral (select (timezone('UTC',now())::date-days.i)::date as day) d
    left join retained r on (r.created_at at time zone 'UTC')::date=d.day
    group by d.day
  )
  select jsonb_build_object(
    'retainedOrders',t.retained_orders,
    'pendingOrders',t.pending_orders,
    'expiredOrders',t.expired_orders,
    'paidOrders',t.paid_orders,
    'heldPaidOrders',t.held_paid_orders,
    'downloadableOrders',t.downloadable_orders,
    'grossTestPence',t.gross_test_pence,
    'days', (select coalesce(jsonb_agg(
      jsonb_build_object('day',d.day,'orders',d.orders,'paid',d.paid,'grossTestPence',d.gross_test_pence)
      order by d.day
    ),'[]'::jsonb) from daily d)
  ) into report from totals t;

  return report;
end $$;

revoke execute on function public.read_my_creator_storefront_analytics(uuid) from public, anon, authenticated, service_role;
grant execute on function public.read_my_creator_storefront_analytics(uuid) to authenticated;
commit;
