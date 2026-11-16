create function public.list_legacy_billing_holds(p_after text default '')
returns table(cursor text, category text, subject_id text, event_id text, event_type text, provider_object_id text, recorded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with pending as (
    select 'invoice:' || h.invoice_id as cursor, 'invoice'::text as category, h.invoice_id as subject_id,
      h.event_id, r.event_type, r.object_id as provider_object_id, h.created_at
    from snoozer.stripe_sandbox_invoice_holds h join snoozer.stripe_webhook_receipts r using (event_id)
    where h.legacy and h.released_at is null
    union all
    select 'gift:' || h.payment_id, 'gift', h.payment_id, h.event_id, r.event_type, r.object_id, h.created_at
    from snoozer.stripe_sandbox_gift_payment_holds h join snoozer.stripe_webhook_receipts r using (event_id)
    where h.legacy and h.released_at is null
  )
  select * from pending where pending.cursor > p_after order by pending.cursor limit 50
$$;
revoke execute on function public.list_legacy_billing_holds(text) from public,anon,authenticated,service_role;
grant execute on function public.list_legacy_billing_holds(text) to service_role;
