begin;
alter table snoozer.creator_sandbox_receipts add column retry_count integer not null default 0 check(retry_count between 0 and 20);
alter table snoozer.creator_sandbox_receipts add column next_attempt_at timestamptz not null default now();
create index creator_receipts_retry on snoozer.creator_sandbox_receipts(platform_id,next_attempt_at,received_at,id) where processed_at is null;

create function public.list_creator_sandbox_receipt_retries(p_platform text,p_limit integer default 5,p_id text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_limit is null or p_limit<1 or p_limit>10 or p_platform is null or p_platform !~ '^acct_[A-Za-z0-9]{1,128}$'
  or (p_id is not null and p_id !~ '^evt_[A-Za-z0-9]{1,128}$') then raise exception 'Invalid receipt batch' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'accountId',r.account_id,'type',r.type,'objectId',r.object_id,'occurredAt',r.occurred_at) order by r.received_at,r.id)
  from (select * from snoozer.creator_sandbox_receipts where platform_id=p_platform
   and ((p_id is not null and id=p_id) or (p_id is null and processed_at is null and retry_count<10 and next_attempt_at<=now()))
   order by received_at,id limit p_limit) r),'[]'::jsonb);
end $$;
create function public.claim_creator_sandbox_receipt_retry(p_id text,p_platform text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 -- Backoff doubles up to one hour; the first minute also leases the bounded provider attempt.
 update snoozer.creator_sandbox_receipts set next_attempt_at=now()+make_interval(secs=>greatest(60,least(3600,30*power(2,least(retry_count,7))))),retry_count=least(20,retry_count+1)
  where id=p_id and platform_id=p_platform and next_attempt_at<=now();
 return found;
end $$;
create function public.purge_creator_sandbox_history(p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare orders_removed integer; receipts_removed integer;
begin
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid retention batch' using errcode='22023'; end if;
 -- Uncertain pending payments and unresolved holds require operator reconciliation, never time-only deletion.
 delete from snoozer.creator_sandbox_orders where id in(select id from snoozer.creator_sandbox_orders where state<>'pending'
  and cardinality(holds)=0 and retained_until<now() and coalesce(access_until,'-infinity')<=now()
  and not exists(select 1 from snoozer.creator_sandbox_receipts r where r.account_id=creator_sandbox_orders.account_id and r.processed_at is null)
  order by retained_until,id limit p_limit for update skip locked);
 get diagnostics orders_removed=row_count;
 delete from snoozer.creator_sandbox_receipts where id in(select id from snoozer.creator_sandbox_receipts
  where order_id is null and processed_at<now()-interval '90 days' and received_at<now()-interval '90 days'
  order by received_at,id limit p_limit for update skip locked);
 get diagnostics receipts_removed=row_count;
 return jsonb_build_object('ordersRemoved',orders_removed,'receiptsRemoved',receipts_removed);
end $$;
create function public.read_creator_sandbox_diagnostics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_read_billing_diagnostics() then raise exception 'Billing diagnostics role required' using errcode='42501'; end if;
 return jsonb_build_object('pendingReceipts',(select count(*) from snoozer.creator_sandbox_receipts where processed_at is null),
  'deferredReceipts',(select count(*) from snoozer.creator_sandbox_receipts where processed_at is null and next_attempt_at>now()),
  'deadLetterReceipts',(select count(*) from snoozer.creator_sandbox_receipts where processed_at is null and retry_count>=10),
  'uncertainOrders',(select count(*) from snoozer.creator_sandbox_orders where state='pending' and checkout_id is null and created_at<now()-interval '23 hours'),
  'heldOrders',(select count(*) from snoozer.creator_sandbox_orders where cardinality(holds)>0));
end $$;
revoke execute on function public.list_creator_sandbox_receipt_retries(text,integer,text),public.claim_creator_sandbox_receipt_retry(text,text),public.purge_creator_sandbox_history(integer) from public,anon,authenticated,service_role;
grant execute on function public.list_creator_sandbox_receipt_retries(text,integer,text),public.claim_creator_sandbox_receipt_retry(text,text),public.purge_creator_sandbox_history(integer) to service_role;
revoke execute on function public.read_creator_sandbox_diagnostics() from public,anon,authenticated,service_role;
grant execute on function public.read_creator_sandbox_diagnostics() to authenticated;
commit;
