-- Read-only operator inspection for Creator Commerce sandbox closeout.
-- Run as a trusted database operator in Supabase SQL Editor against the
-- SAME hosted project used by Snoozer. This never changes rows or gates.
--
-- The output contains counts/status only, not buyer identities or receipts.
-- A clean result is not proof that Stripe delivered or processed events.
--
-- 1. Current new-purchase policy and reviewed offers.
select
  (select enabled from snoozer.creator_sandbox_policy where singleton is true) as new_purchase_db_gate,
  (select count(*) from snoozer.creator_sandbox_offers where enabled and review_expires_at>now()) as active_reviewed_offers,
  (select count(*) from snoozer.creator_sandbox_offers where enabled and review_expires_at<=now()) as enabled_but_expired_offers;

-- 2. Existing sandbox orders: this query intentionally does not identify buyers.
select
  count(*) as total_orders,
  count(*) filter (where state='pending') as pending_orders,
  count(*) filter (where state='pending' and checkout_id is null and created_at<now()-interval '23 hours') as uncertain_checkout_orders,
  count(*) filter (where state='paid') as paid_orders,
  count(*) filter (where state='expired') as expired_orders,
  count(*) filter (where cardinality(holds)>0) as held_orders,
  count(*) filter (where state='paid' and access_until>now() and cardinality(holds)=0) as paid_unheld_with_unexpired_access
from snoozer.creator_sandbox_orders;

-- 3. Signature-verified persisted receipts and recovery backlog.
select
  count(*) as total_persisted_receipts,
  count(*) filter (where processed_at is not null) as processed_receipts,
  count(*) filter (where processed_at is null) as pending_receipts,
  count(*) filter (where processed_at is null and next_attempt_at>now()) as deferred_receipts,
  count(*) filter (where processed_at is null and retry_count>=10) as dead_letter_receipts,
  count(*) filter (where processed_at is null and next_attempt_at<=now() and retry_count<10) as recoverable_now
from snoozer.creator_sandbox_receipts;

-- 4. Previously approved database-only retention fixture. Do not modify it
--    to manufacture proof of a natural pg_cron deletion.
select
  count(*) as historical_retention_fixture_rows_remaining
from snoozer.creator_sandbox_receipts
where id='evt_RetentionFixture20261119';

-- 5. Retention schedule registration (registration != successful execution).
select jobid,jobname,schedule,active
from cron.job
where jobname='snoozer-creator-retention-v1';

-- 6. The LAST five natural scheduled executions and their actual result.
--    A successful run plus genuine fixture disappearance is required evidence.
select r.jobid,r.status,r.start_time,r.end_time,r.return_message
from cron.job_run_details r
join cron.job j on j.jobid=r.jobid
where j.jobname='snoozer-creator-retention-v1'
order by r.start_time desc
limit 5;

-- Hosted Render switch SNOOZER_CREATOR_CHECKOUT_ENABLED cannot be read from
-- Supabase SQL. Verify it separately in the intended Render workspace.
-- Never run destructive migrations, refunds, test-clock overrides or fabricated
-- provider receipts to make these checks green.
