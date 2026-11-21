-- Creator Commerce sandbox — isolated risk-event evidence (READ-ONLY)
-- Run only in the authorised Snoozer Supabase SQL Editor.
-- Replace the all-zero order UUID below with the NEW isolated sandbox QA order.
-- Do NOT use the original paid £5 order for refund/dispute/fraud testing.
-- Default UUID produces no rows; the query never mutates orders, receipts, or gates.
-- A processed receipt is provider-derived evidence ONLY when independently paired
-- with the genuine Stripe Workbench signed Event delivery (HTTP 204).
-- SQL eligibility is informational: the actual download route always performs
-- fresh canonical Stripe reconciliation plus authenticated ownership verification.

select
  o.id as isolated_order_id,
  o.state,
  o.holds,
  o.paid_at is not null as paid_timestamp_present,
  o.access_until > now() as original_access_window_open,
  o.payment_id is not null and o.charge_id is not null as payment_bound,
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type='checkout.session.completed') as checkout_receipts_processed,
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type='charge.refunded') as refund_receipts_processed,
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type like 'charge.dispute.%') as dispute_receipts_processed,
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type like 'radar.early_fraud_warning.%') as fraud_warning_receipts_processed,
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is null) as linked_pending_receipts,
  -- A pending dispute/fraud signal may not yet have an order_id.
  -- Account-level pending risk is a conservative alert, NOT proof about this order.
  (select count(*)::integer
     from snoozer.creator_sandbox_receipts r
    where r.account_id=o.account_id and r.platform_id=o.platform_id
      and r.processed_at is null and (
        r.type='charge.refunded'
        or r.type like 'charge.dispute.%'
        or r.type like 'radar.early_fraud_warning.%')) as seller_pending_risk_receipts,
  not exists (
    select 1 from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type='charge.refunded'
  ) or 'refund'=any(o.holds) as refund_hold_consistent,
  not exists (
    select 1 from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type like 'charge.dispute.%'
  ) or 'dispute'=any(o.holds) as dispute_hold_consistent,
  not exists (
    select 1 from snoozer.creator_sandbox_receipts r
    where r.order_id=o.id and r.processed_at is not null
      and r.type like 'radar.early_fraud_warning.%'
  ) or 'fraud'=any(o.holds) as fraud_hold_consistent,
  o.state='paid' and cardinality(o.holds)=0 and o.access_until>now()
    as database_access_eligible_only
from snoozer.creator_sandbox_orders o
where o.id='00000000-0000-0000-0000-000000000000'::uuid;
